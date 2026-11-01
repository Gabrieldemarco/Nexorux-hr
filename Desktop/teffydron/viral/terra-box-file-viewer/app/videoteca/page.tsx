import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { FileBrowser } from '@/components/file-browser'
import { ErrorNotice } from '@/components/error-notice'
import { InvalidLink } from '@/components/invalid-link'
import { FileListSkeleton } from '@/components/file-list-skeleton'
import { QrGenerator } from '@/components/qr-generator'
import { SiteHeader } from '@/components/site-header'
import { getViewer } from '@/lib/viewer'
import { listFiles, TeraboxError } from '@/lib/terabox'
import { shareHref } from '@/lib/share'
import { getCachedVideoPaths, getHiddenFolderPaths, isPathHidden } from '@/lib/admin'
import { preferCachedVideoDuplicates } from '@/lib/video-list'
import { getVpsLibraryEntries, VPS_LIBRARY_PREFIX } from '@/lib/vps-library'

export const metadata: Metadata = {
  title: 'Videoteca de Polo | Archivo Audiovisual',
  description: 'Explora y reproduce los videos aéreos del polo almacenados en el VPS y TeraBox.',
}

function normalizeDir(dir: string | string[] | undefined) {
  const value = Array.isArray(dir) ? dir[0] : dir
  if (!value || !value.startsWith('/')) return '/'
  return value.replace(/\/+$/, '') || '/'
}

async function FolderContents({ dir, userId }: { dir: string; userId?: string }) {
  if (!(dir === VPS_LIBRARY_PREFIX || dir.startsWith(`${VPS_LIBRARY_PREFIX}/`)) &&
      await isPathHidden(dir)) {
    return <InvalidLink />
  }

  try {
    if (dir === VPS_LIBRARY_PREFIX || dir.startsWith(`${VPS_LIBRARY_PREFIX}/`)) {
      const localDirectory = dir === VPS_LIBRARY_PREFIX ? '' : dir.slice(VPS_LIBRARY_PREFIX.length + 1)
      const files = await getVpsLibraryEntries(localDirectory, userId)
      const withDirectLinks = files.map((file) => {
        const relativePath = file.path.slice(VPS_LIBRARY_PREFIX.length + 1)
        const encodedPath = encodeURIComponent(relativePath)
        return {
          ...file,
          cachedOnVps: !file.isDir && file.category === 1,
          shareHref: null,
          directHref: file.isDir
            ? null
            : file.category === 1
              ? `/vps?path=${encodedPath}&userId=${userId ?? ''}`
              : `/api/library/file?path=${encodedPath}&userId=${userId ?? ''}`,
        }
      })
      return <FileBrowser files={withDirectLinks} />
    }

    const [files, hiddenPaths] = await Promise.all([
      listFiles(dir),
      getHiddenFolderPaths(),
    ])

    // Filtrar carpetas ocultas en TODOS los niveles, no solo en la raíz
    const filtered = files.filter((f) => {
      if (!f.isDir) return true
      // Ocultar si la carpeta está marcada como oculta
      if (hiddenPaths.has(f.path)) return false
      // Ocultar si está dentro de una carpeta oculta
      for (const hiddenPath of hiddenPaths) {
        if (f.path.startsWith(`${hiddenPath}/`)) return false
      }
      return true
    })
    const cachedVideoPaths = await getCachedVideoPaths(
      filtered
        .filter((file) => !file.isDir && file.category === 1)
        .map(({ path, size, modifiedAt }) => ({ path, size, modifiedAt })),
    )

    const withShare = filtered.map((file) => ({
      ...file,
      cachedOnVps: !file.isDir && cachedVideoPaths.has(file.path),
      shareHref: file.isDir
        ? shareHref('folder', file.path)
        : file.category === 1
          ? shareHref('video', file.path)
          : null,
    }))
    const localRootEntries = dir === '/' ? await getVpsLibraryEntries('', userId).catch((error: unknown) => {
      console.error('[vps-library] Could not list the local library:', error)
      return []
    }) : []
    const localEntries = localRootEntries.map((file) => {
      const relativePath = file.path.slice(VPS_LIBRARY_PREFIX.length + 1)
      const encodedPath = encodeURIComponent(relativePath)
      return {
        ...file,
        cachedOnVps: !file.isDir && file.category === 1,
        shareHref: null,
        directHref: file.isDir
          ? null
          : file.category === 1
            ? `/vps?path=${encodedPath}&userId=${userId ?? ''}`
            : `/api/library/file?path=${encodedPath}&userId=${userId ?? ''}`,
      }
    })
    return <FileBrowser files={preferCachedVideoDuplicates([...withShare, ...localEntries])} />
  } catch (error) {
    const code = error instanceof TeraboxError ? error.code : 'request'
    const message =
      error instanceof Error ? error.message : 'Error al conectar con TeraBox.'
    if (dir === '/') {
      try {
        const localFiles = (await getVpsLibraryEntries('', userId)).map((file) => {
          const relativePath = file.path.slice(VPS_LIBRARY_PREFIX.length + 1)
          const encodedPath = encodeURIComponent(relativePath)
          return {
            ...file,
            cachedOnVps: !file.isDir && file.category === 1,
            shareHref: null,
            directHref: file.isDir
              ? null
              : file.category === 1
                ? `/vps?path=${encodedPath}&userId=${userId ?? ''}`
                : `/api/library/file?path=${encodedPath}&userId=${userId ?? ''}`,
          }
        })
        return (
          <div className="flex flex-col gap-4">
            <ErrorNotice code={code} message={message} />
            <FileBrowser files={localFiles} />
          </div>
        )
      } catch (libraryError) {
        console.error('[vps-library] Could not list the local library:', libraryError)
      }
    }
    return <ErrorNotice code={code} message={message} />
  }
}

export default async function VideotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string | string[] }>
}) {
  const viewer = await getViewer()
  const userId = viewer?.id ?? undefined
  const { dir: rawDir } = await searchParams
  const dir = normalizeDir(rawDir)
  const folderName = dir === '/' ? 'Videoteca de Polo' : (dir.split('/').pop() === '__vps__' ? 'Biblioteca del VPS' : dir.split('/').pop() ?? dir)
  const isVpsDirectory = dir === VPS_LIBRARY_PREFIX || dir.startsWith(`${VPS_LIBRARY_PREFIX}/`)

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader
        title="Videoteca de Polo"
        subtitle="Archivo audiovisual del polo."
        showDroneHero={false}
      />

      <main id="videoteca" className="scroll-mt-8 mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Breadcrumbs dir={dir} />
          <Suspense key={dir} fallback={<FileListSkeleton />}>
            <FolderContents dir={dir} userId={userId} />
          </Suspense>
        </div>
        <aside className="w-full lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
          <QrGenerator
            key={dir}
            folderHref={isVpsDirectory ? `/videoteca?dir=${encodeURIComponent(dir)}&userId=${userId ?? ''}` : shareHref('folder', dir)}
            folderName={folderName}
          />
        </aside>
      </main>
    </div>
  )
}
