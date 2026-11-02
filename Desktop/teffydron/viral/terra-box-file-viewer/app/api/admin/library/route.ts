import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/viewer'
import {
  createVpsLibraryFolder,
  getVpsLibrarySnapshot,
  moveVpsLibraryFile,
  renameVpsLibraryFolder,
  renameVpsLibraryFile,
  withVpsLibraryWriteLock,
} from '@/lib/vps-library'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const userId = params.get('userId') ?? viewer.id
  return NextResponse.json(await getVpsLibrarySnapshot(userId), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  try {
    const body = await request.json() as {
      action?: string
      path?: string
      name?: string
      parent?: string
      destination?: string
      userId?: string
    }

    await withVpsLibraryWriteLock(async () => {
      if (body.action === 'create-folder') {
        await createVpsLibraryFolder(body.parent ?? '', body.name ?? '', body.userId ?? viewer.id)
      } else if (body.action === 'rename-folder') {
        await renameVpsLibraryFolder(body.path ?? '', body.name ?? '', body.userId ?? viewer.id)
      } else if (body.action === 'rename-file') {
        await renameVpsLibraryFile(body.path ?? '', body.name ?? '', body.userId ?? viewer.id)
      } else if (body.action === 'move-file') {
        await moveVpsLibraryFile(body.path ?? '', body.destination ?? '', body.userId ?? viewer.id)
      } else {
        throw new Error('La operación solicitada no es válida.')
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la biblioteca.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
