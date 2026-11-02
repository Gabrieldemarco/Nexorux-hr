import 'server-only'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, lstat, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { TeraboxFile } from '@/lib/terabox'
import { VIDEO_CACHE_LIMIT_BYTES, getVideoCacheDirectory } from '@/lib/video-cache'
import { db } from '@/lib/db'
import { videoCache } from '@/lib/db/schema'

export const VPS_LIBRARY_PREFIX = '/__vps__'
const COVER_PREFIX = '__folder_cover__.'

const MEDIA_TYPES: Record<string, { category: number; mime: string }> = {
  '.mp4': { category: 1, mime: 'video/mp4' },
  '.m4v': { category: 1, mime: 'video/mp4' },
  '.mov': { category: 1, mime: 'video/quicktime' },
  '.webm': { category: 1, mime: 'video/webm' },
  '.mkv': { category: 1, mime: 'video/x-matroska' },
  '.mp3': { category: 2, mime: 'audio/mpeg' },
  '.m4a': { category: 2, mime: 'audio/mp4' },
  '.aac': { category: 2, mime: 'audio/aac' },
  '.wav': { category: 2, mime: 'audio/wav' },
  '.ogg': { category: 2, mime: 'audio/ogg' },
  '.jpg': { category: 3, mime: 'image/jpeg' },
  '.jpeg': { category: 3, mime: 'image/jpeg' },
  '.png': { category: 3, mime: 'image/png' },
  '.webp': { category: 3, mime: 'image/webp' },
  '.gif': { category: 3, mime: 'image/gif' },
}

const COVER_TYPES = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

type LibraryItem = {
  path: string
  name: string
  size: number
  folder: string
  modifiedAt: number
  isDirectory: boolean
}

let writeQueue: Promise<void> = Promise.resolve()

export function withVpsLibraryWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation)
  writeQueue = result.then(() => undefined, () => undefined)
  return result
}

export async function withVpsSharedStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const lockPath = join(getVpsLibraryDirectory(), '.teffydron-storage-quota.lock')
  await mkdir(dirname(lockPath), { recursive: true })
  const startedAt = Date.now()

  while (true) {
    try {
      const handle = await open(lockPath, 'wx', 0o600)
      try {
        await handle.writeFile(`${process.pid}\n`)
      } finally {
        await handle.close()
      }
      break
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
      let stale = false
      try {
        const content = await readFile(lockPath, 'utf8')
        const lockPid = Number(content.trim())
        if (Number.isSafeInteger(lockPid) && lockPid > 0) {
          try {
            process.kill(lockPid, 0)
          } catch (processError) {
            stale = processError instanceof Error && 'code' in processError && processError.code === 'ESRCH'
          }
        } else if (Date.now() - (await stat(lockPath)).mtimeMs > 10_000) {
          stale = true
        }
      } catch (readError) {
        if (readError instanceof Error && 'code' in readError && readError.code === 'ENOENT') continue
        throw readError
      }
      if (stale) {
        await rm(lockPath, { force: true })
        continue
      }
      if (Date.now() - startedAt > 12 * 60 * 60 * 1000) {
        throw new Error('Se agotó el tiempo de espera del espacio de almacenamiento compartido.')
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 250))
    }
  }

  try {
    return await operation()
  } finally {
    await rm(lockPath, { force: true })
  }
}

export function getVpsLibraryDirectory(userId?: string) {
  const configured = process.env.VPS_LIBRARY_DIR
  if (configured) {
    const base = resolve(configured)
    if (userId) return resolve(base, 'users', userId)
    return base
  }
  const defaultBase = resolve(getVideoCacheDirectory(), '..', 'library')
  if (userId) return resolve(defaultBase, 'users', userId)
  return defaultBase
}

export function getUserVpsLibraryDirectory(userId: string) {
  return getVpsLibraryDirectory(userId)
}

function mediaType(name: string) {
  return MEDIA_TYPES[extname(name).toLowerCase()] ?? null
}

function validatePath(value: string, allowEmpty = true, allowCover = false) {
  if (typeof value !== 'string' || value.includes('\0') || value.includes('\\') || value.startsWith('/')) {
    throw new Error('La ruta de la biblioteca no es válida.')
  }
  const parts = value.split('/').filter(Boolean)
  if ((!allowEmpty && parts.length === 0) || parts.some((part) =>
    part === '.' || part === '..' || part.startsWith('.') ||
    (!allowCover && part.startsWith(COVER_PREFIX)) || part.length > 180
  )) {
    throw new Error('La ruta de la biblioteca no es válida.')
  }
  return parts.join('/')
}

function resolveInsideLibrary(relativePath: string, userId?: string, allowCover = false) {
  const safePath = validatePath(relativePath, true, allowCover)
  const root = getVpsLibraryDirectory(userId)
  const fullPath = resolve(root, ...safePath.split('/').filter(Boolean))
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    throw new Error('La ruta solicitada está fuera de la biblioteca.')
  }
  return fullPath
}

export async function ensureVpsLibraryDirectory(userId?: string) {
  await mkdir(getVpsLibraryDirectory(userId), { recursive: true, mode: 0o750 })
}

async function getCover(directory: string) {
  for (const extension of COVER_TYPES) {
    const coverPath = join(directory, `${COVER_PREFIX}${extension.slice(1)}`)
    try {
      if ((await lstat(coverPath)).isFile()) return coverPath
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue
      throw error
    }
  }
  return null
}

export async function getVpsLibraryEntries(directory: string, userId?: string): Promise<TeraboxFile[]> {
  const safeDirectory = validatePath(directory)
  await ensureVpsLibraryDirectory(userId)
  const fullDirectory = resolveInsideLibrary(safeDirectory, userId)
  const entries = await readdir(fullDirectory, { withFileTypes: true })
  const results: TeraboxFile[] = []

  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name.startsWith(COVER_PREFIX)) continue
    const relativePath = [safeDirectory, entry.name].filter(Boolean).join('/')
    const fullPath = join(fullDirectory, entry.name)

    if (entry.isDirectory()) {
      const coverPath = await getCover(fullPath)
      results.push({
        fsId: `vps:${relativePath}`,
        name: entry.name,
        path: `${VPS_LIBRARY_PREFIX}/${relativePath}`,
        size: 0,
        isDir: true,
        modifiedAt: (await stat(fullPath)).mtimeMs,
        category: 0,
        thumbnail: coverPath
          ? `/api/library/file?path=${encodeURIComponent(`${relativePath}/${basename(coverPath)}`)}&userId=${userId ?? ''}`
          : null,
      })
      continue
    }

    const type = mediaType(entry.name)
    if (!entry.isFile() || !type) continue
    const fileStat = await stat(fullPath)
    results.push({
      fsId: `vps:${relativePath}`,
      name: entry.name,
      path: `${VPS_LIBRARY_PREFIX}/${relativePath}`,
      size: fileStat.size,
      isDir: false,
      modifiedAt: fileStat.mtimeMs,
      category: type.category,
      thumbnail: type.category === 3
        ? `/api/library/file?path=${encodeURIComponent(relativePath)}&userId=${userId ?? ''}`
        : null,
    })
  }

  return results.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}

async function scanDirectory(directory: string, folder: string, output: LibraryItem[], userId?: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const fullPath = join(directory, entry.name)
    const relativePath = [folder, entry.name].filter(Boolean).join('/')
    if (entry.isDirectory()) {
      output.push({
        path: relativePath,
        name: entry.name,
        size: 0,
        folder,
        modifiedAt: (await stat(fullPath)).mtimeMs,
        isDirectory: true,
      })
      await scanDirectory(fullPath, relativePath, output, userId)
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      const fileStat = await stat(fullPath)
      if (entry.name.startsWith(COVER_PREFIX)) continue
      output.push({
        path: relativePath,
        name: entry.name,
        size: fileStat.size,
        folder,
        modifiedAt: fileStat.mtimeMs,
        isDirectory: false,
      })
    }
  }
}

async function scanVideoCache(output: LibraryItem[]) {
  const cacheDir = getVideoCacheDirectory()
  try {
    const entries = await readdir(cacheDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isFile()) continue
      const fullPath = join(cacheDir, entry.name)
      const fileStat = await stat(fullPath)
      // Los archivos de caché tienen nombres hash, usamos el nombre modificado como nombre legible
      output.push({
        path: `cache/${entry.name}`,
        name: entry.name, // Podríamos mapear a un nombre más legible si lo tenemos
        size: fileStat.size,
        folder: 'Caché de TeraBox',
        modifiedAt: fileStat.mtimeMs,
        isDirectory: false,
      })
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}

export async function getVpsLibrarySnapshot(userId?: string) {
  await ensureVpsLibraryDirectory(userId)
  const items: LibraryItem[] = []
  await scanDirectory(getVpsLibraryDirectory(userId), '', items, userId)
  
  // Agregar videos de la caché de TeraBox
  const cachedVideos = await db.select().from(videoCache)
  for (const video of cachedVideos) {
    try {
      const cachePath = getVideoCachePath(video.path)
      const fileStat = await stat(cachePath)
      items.push({
        path: `cache/${video.path}`,
        name: video.path.split('/').pop() || video.path,
        size: fileStat.size,
        folder: 'Caché de TeraBox',
        modifiedAt: fileStat.mtimeMs,
        isDirectory: false,
      })
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) continue
    }
  }
  
  const folders = [{ path: '', name: 'Biblioteca raíz' }, ...items
    .filter((item) => item.isDirectory)
    .map(({ path, name }) => ({ path, name }))]
  const files = items.filter((item) => !item.isDirectory)
  const usedBytes = await getVpsSharedStorageBytes(userId)
  return { folders, files, usedBytes, limitBytes: VIDEO_CACHE_LIMIT_BYTES }
}

export async function getVpsLibraryBytes(userId?: string) {
  await ensureVpsLibraryDirectory(userId)
  return measureDirectory(getVpsLibraryDirectory(userId))
}

export async function getVpsSharedStorageBytes(userId?: string) {
  return (await getVpsLibraryBytes(userId)) + await measureDirectory(getVideoCacheDirectory())
}

export async function getVpsLibraryFile(relativePath: string, includeCover = false, userId?: string) {
  const safePath = validatePath(relativePath, false, includeCover)
  const name = safePath.split('/').pop()!
  const isCover = name.startsWith(COVER_PREFIX) && COVER_TYPES.includes(extname(name).toLowerCase())
  if ((!mediaType(name) && !(includeCover && isCover)) || (name.startsWith(COVER_PREFIX) && !isCover)) {
    throw new Error('El archivo solicitado no es un medio permitido.')
  }
  const fullPath = resolveInsideLibrary(safePath, userId, includeCover)
  const fileStat = await lstat(fullPath)
  if (!fileStat.isFile()) throw new Error('El archivo solicitado no existe.')
  return { fullPath, name, size: fileStat.size, mime: isCover ? MEDIA_TYPES[extname(name).toLowerCase()].mime : mediaType(name)!.mime }
}

async function measureDirectory(directory: string): Promise<number> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return 0
    throw error
  }
  let bytes = 0
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    if (entry.name === '.teffydron-storage-quota.lock') continue
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) bytes += await measureDirectory(fullPath)
    else if (entry.isFile()) bytes += (await stat(fullPath)).size
  }
  return bytes
}

export async function writeVpsLibraryUpload(
  request: Request,
  directory: string,
  name: string,
  maximumBytes: number,
  userId?: string,
) {
  const safeDirectory = validatePath(directory)
  const safeName = validateFileName(name)
  const folder = resolveInsideLibrary(safeDirectory, userId)
  await mkdir(folder, { recursive: true, mode: 0o750 })
  const destination = join(folder, safeName)
  try {
    await lstat(destination)
    throw new Error('Ya existe un archivo con ese nombre en la carpeta.')
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  return writeRequestBody(request, destination, maximumBytes, userId)
}

export async function writeVpsLibraryCover(
  request: Request,
  directory: string,
  name: string,
  maximumBytes: number,
  userId?: string,
) {
  const safeDirectory = validatePath(directory)
  const extension = extname(validateFileName(name)).toLowerCase()
  if (!COVER_TYPES.includes(extension)) throw new Error('La portada debe ser una imagen JPG, PNG, GIF o WEBP.')
  const folder = resolveInsideLibrary(safeDirectory, userId)
  await mkdir(folder, { recursive: true, mode: 0o750 })
  const destination = join(folder, `${COVER_PREFIX}${extension.slice(1)}`)
  const temporary = join(folder, `.cover-${randomUUID()}.upload`)
  await writeRequestBody(
    request,
    temporary,
    maximumBytes,
    'La portada supera el espacio disponible o el límite máximo de 10 MB.',
    userId,
  )
  await rename(temporary, destination)
  for (const oldExtension of COVER_TYPES) {
    if (oldExtension === extension) continue
    await rm(join(folder, `${COVER_PREFIX}${oldExtension.slice(1)}`), { force: true })
  }
}

async function writeRequestBody(
  request: Request,
  destination: string,
  maximumBytes: number,
  limitMessage = 'El archivo supera el espacio disponible dentro del límite de 70 GB.',
  userId?: string,
) {
  if (!request.body) throw new Error('No se recibieron datos para guardar.')
  const temporary = `${destination}.${randomUUID()}.upload`
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(limitMessage)
  }

  let received = 0
  try {
    await pipeline(
      Readable.fromWeb(request.body as import('node:stream/web').ReadableStream<Uint8Array>),
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length
          if (received > maximumBytes) {
            callback(new Error(limitMessage))
            return
          }
          callback(null, chunk)
        },
      }),
      createWriteStream(temporary, { flags: 'wx', mode: 0o640 }),
    )
    await rename(temporary, destination)
    return received
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

function validateFileName(value: string) {
  const name = value.trim()
  if (!name || name.length > 180 || name === '.' || name === '..' || /[\\/\0]/.test(name) ||
      name.startsWith('.') || name.startsWith(COVER_PREFIX) || !mediaType(name)) {
    throw new Error('El nombre o formato del archivo no está permitido.')
  }
  return name
}

export async function createVpsLibraryFolder(parentPath: string, name: string, userId?: string) {
  await ensureVpsLibraryDirectory(userId)
  const parent = validatePath(parentPath)
  const safeName = validateFolderName(name)
  const target = resolveInsideLibrary([parent, safeName].filter(Boolean).join('/'), userId)
  await mkdir(target, { recursive: false, mode: 0o750 })
}

export async function renameVpsLibraryFolder(path: string, name: string, userId?: string) {
  const current = validatePath(path, false)
  const safeName = validateFolderName(name)
  const parent = current.split('/').slice(0, -1).join('/')
  const destination = resolveInsideLibrary([parent, safeName].filter(Boolean).join('/'), userId)
  if (destination !== resolveInsideLibrary(current, userId)) {
    try {
      await lstat(destination)
      throw new Error('Ya existe una carpeta con ese nombre.')
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
  }
  await rename(resolveInsideLibrary(current, userId), destination)
}

export async function moveVpsLibraryFile(path: string, destinationFolder: string, userId?: string) {
  await ensureVpsLibraryDirectory(userId)
  const current = validatePath(path, false)
  const destination = validatePath(destinationFolder)
  const source = resolveInsideLibrary(current, userId)
  const sourceStat = await lstat(source)
  if (!sourceStat.isFile() || !mediaType(current.split('/').pop()!)) {
    throw new Error('Solo se pueden mover archivos multimedia.')
  }
  const targetFolder = resolveInsideLibrary(destination, userId)
  const targetStat = await lstat(targetFolder)
  if (!targetStat.isDirectory()) throw new Error('La carpeta de destino no existe.')
  const target = join(targetFolder, current.split('/').pop()!)
  try {
    await lstat(target)
    throw new Error('Ya existe un archivo con ese nombre en la carpeta de destino.')
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  await rename(source, target)
}

function validateFolderName(value: string) {
  const name = value.trim()
  if (!name || name.length > 120 || name === '.' || name === '..' ||
      /[\\/\0]/.test(name) || name.startsWith('.') || name.startsWith(COVER_PREFIX)) {
    throw new Error('El nombre de la carpeta no es válido.')
  }
  return name
}

export async function renameVpsLibraryFile(path: string, name: string, userId?: string) {
  const current = validatePath(path, false)
  const safeName = validateFileName(name)
  const parent = current.split('/').slice(0, -1).join('/')
  const destination = resolveInsideLibrary([parent, safeName].filter(Boolean).join('/'), userId)
  if (destination !== resolveInsideLibrary(current, userId)) {
    try {
      await lstat(destination)
      throw new Error('Ya existe un archivo con ese nombre.')
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && 'code === 'ENOENT')) throw error
    }
  }
  await rename(resolveInsideLibrary(current, userId), destination)
}
