import type { Metadata } from 'next'
import Link from 'next/link'
import { Folder, PlayCircle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { InvalidLink } from '@/components/invalid-link'
import { ErrorNotice } from '@/components/error-notice'
import { VpsCacheIndicator } from '@/components/vps-cache-indicator'
import { listFiles, TeraboxError } from '@/lib/terabox'
import { firstParam, shareHref, verifyPath } from '@/lib/share'
import { getCachedVideoPaths, getHiddenFolderPaths } from '@/lib/admin'
import { isPathHidden } from '@/lib/admin'
import { preferCachedVideoDuplicates } from '@/lib/video-list'

export const metadata: Metadata = { title: 'Videos · Polo' }

export default async function FolderPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string | string[]; s?: string | string[] }>
}) {
  const params = await searchParams
  const path = firstParam(params.p)
  const sig = firstParam(params.s)

  if (!verifyPath('folder', path, sig) || await isPathHidden(path!)) return <InvalidLink />

  const name = path === '/' ? 'Videoteca de Polo' : (path!.split('/').pop() ?? path!)

  let content: React.ReactNode
  try {
    const [items, hiddenPaths] = await Promise.all([
      listFiles(path!),
      getHiddenFolderPaths(),
    ])

    // Filtrar carpetas ocultas en TODOS los niveles
    const filteredItems = items.filter((f) => {
      if (!f.isDir) return true
      // Ocultar si la carpeta está marcada como oculta
      if (hiddenPaths.has(f.path)) return false
      // Ocultar si está dentro de una carpeta oculta
      for (const hiddenPath of hiddenPaths) {
        if (f.path.startsWith(`${hiddenPath}/`)) return false
      }
      return true
    }).filter((f) => f.isDir || f.category === 1)

    const cachedVideoPaths = await getCachedVideoPaths(
      filteredItems
        .filter((item) => !item.isDir && item.category === 1)
        .map(({ path: itemPath, size, modifiedAt }) => ({
          path: itemPath,
          size,
          modifiedAt,
        })),
    )
    const visibleItems = preferCachedVideoDuplicates(filteredItems.map((item) => ({
      ...item,
      cachedOnVps: !item.isDir && cachedVideoPaths.has(item.path),
    })))
    content =
      visibleItems.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Esta carpeta no tiene videos.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <li key={item.fsId}>
              <Link
                href={shareHref(item.isDir ? 'folder' : 'video', item.path)}
                className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="relative flex aspect-video items-center justify-center bg-primary">
                  {item.cachedOnVps && (
                    <VpsCacheIndicator className="absolute top-2 left-2 z-10" />
                  )}
                  {item.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  {item.isDir ? (
                    <Folder className="size-12 text-accent" aria-hidden="true" />
                  ) : (
                    <PlayCircle
                      className="relative size-12 text-primary-foreground drop-shadow-md transition-transform group-hover:scale-110"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span className="truncate p-3 text-sm font-medium" title={item.name}>
                  {item.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )
  } catch (error) {
    const code = error instanceof TeraboxError ? error.code : 'request'
    content = (
      <ErrorNotice code={code} message={error instanceof Error ? error.message : 'Error'} />
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader title={name} subtitle="Elige un video para verlo." />
      <main className="mx-auto max-w-6xl px-4 py-6">{content}</main>
    </div>
  )
}
