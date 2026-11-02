'use client'

import { useEffect, useRef, useState } from 'react'
import { Folder, FolderOpen, ImagePlus, LoaderCircle, Pencil, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getCurrentUserId } from '@/app/actions/admin'

type FolderItem = { path: string; name: string }
type FileItem = { path: string; name: string; size: number; folder: string; modifiedAt: number }
type Snapshot = { folders: FolderItem[]; files: FileItem[]; usedBytes: number; limitBytes: number }

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

async function readResponse(response: Response) {
  const result = await response.json() as { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.')
  return result
}

export function VpsLibraryManager() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [selectedFolder, setSelectedFolder] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  async function refresh() {
    const userId = await getCurrentUserId()
    const query = new URLSearchParams({ userId: userId ?? '' })
    const response = await fetch(`/api/admin/library?${query}`, { cache: 'no-store' })
    const next = await readResponse(response) as Snapshot
    setSnapshot(next)
  }

  useEffect(() => {
    void refresh().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la biblioteca.')
    })
  }, [])

  async function mutate(body: Record<string, string>) {
    const userId = await getCurrentUserId()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await readResponse(await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: userId ?? '' }),
      }))
      await refresh()
      setNotice('Cambios guardados.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la biblioteca.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const userId = await getCurrentUserId()
    const list = Array.from(files)
    if (!list.length) return
    setError('')
    setNotice('')
    for (let index = 0; index < list.length; index++) {
      const file = list[index]
      setUploading(`Subiendo ${index + 1} de ${list.length}: ${file.name}`)
      try {
        const query = new URLSearchParams({ folder: selectedFolder, name: file.name, userId: userId ?? '' })
        await readResponse(await fetch(`/api/admin/library/upload?${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        }))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `No se pudo subir ${file.name}.`)
        setUploading('')
        await refresh().catch(() => undefined)
        return
      }
    }
    setUploading('')
    setNotice(`${list.length} archivo(s) subido(s).`)
    try {
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Los archivos subieron, pero no se pudo actualizar la lista.')
    }
  }

  async function uploadCover(folder: string, file: File | undefined) {
    const userId = await getCurrentUserId()
    if (!file) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const query = new URLSearchParams({ folder, name: file.name, userId: userId ?? '' })
      await readResponse(await fetch(`/api/admin/library/cover?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      }))
      await refresh()
      setNotice('Portada de carpeta actualizada.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la portada.')
    } finally {
      setBusy(false)
    }
  }

  function moveFile(path: string, destination: string) {
    void mutate({ action: 'move-file', path, destination })
  }

  function renameFile(path: string, currentName: string) {
    const name = window.prompt('Nuevo nombre del archivo:', currentName)
    if (name?.trim()) void mutate({ action: 'rename-file', path, name })
  }

  function handleDrop(event: React.DragEvent, destination: string) {
    event.preventDefault()
    const path = event.dataTransfer.getData('text/vps-library-file')
    if (path) moveFile(path, destination)
  }

  const folders = snapshot?.folders ?? []
  const files = snapshot?.files ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Espacio usado compartido</p>
          <p className="mt-1 font-semibold">
            {formatBytes(snapshot?.usedBytes ?? 0)} / {formatBytes(snapshot?.limitBytes ?? 70 * 1024 ** 3)}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Carpetas locales</p>
          <p className="mt-1 font-semibold">{Math.max(0, folders.length - 1)}</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs text-muted-foreground">Archivos locales</p>
          <p className="mt-1 font-semibold">{files.length}</p>
        </div>
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files)
        }}
        className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-end"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium">
          Carpeta para guardar
          <select
            value={selectedFolder}
            onChange={(event) => setSelectedFolder(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {folders.map((folder) => (
              <option key={folder.path || 'root'} value={folder.path}>
                {folder.path ? `${folder.name} — ${folder.path}` : folder.name}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          className="sr-only"
          onChange={(event) => {
            if (event.currentTarget.files) void uploadFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <Button type="button" onClick={() => fileInput.current?.click()} disabled={busy || Boolean(uploading)} className="gap-2">
          {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading || 'Subir varios archivos'}
        </Button>
        <p className="text-xs text-muted-foreground sm:self-center">También podés soltarlos aquí.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {folders.map((folder) => (
          <div
            key={folder.path || 'root'}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, folder.path)}
            className={cn(
              'rounded-xl border bg-background p-4 transition-colors',
              folder.path === selectedFolder ? 'border-primary ring-1 ring-primary/20' : 'hover:border-primary/40',
            )}
          >
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{folder.name}</p>
                <p className="truncate text-xs text-muted-foreground">{folder.path || 'Raíz'}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedFolder(folder.path)}>
                Subir aquí
              </Button>
              {folder.path && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy}
                    onClick={() => {
                      const name = window.prompt('Nuevo nombre de la carpeta:', folder.name)
                      if (name?.trim()) void mutate({ action: 'rename-folder', path: folder.path, name })
                    }}
                  >
                    <Pencil className="size-3.5" /> Renombrar
                  </Button>
                  <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-xs font-medium hover:bg-muted">
                    <ImagePlus className="size-3.5" /> Portada
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => {
                        void uploadCover(folder.path, event.currentTarget.files?.[0])
                        event.currentTarget.value = ''
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex flex-col gap-2 rounded-xl border bg-background p-4 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          if (!newFolderName.trim()) return
          void mutate({ action: 'create-folder', parent: selectedFolder, name: newFolderName })
          setNewFolderName('')
        }}
      >
        <Input
          value={newFolderName}
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder={`Nueva carpeta dentro de ${folders.find((folder) => folder.path === selectedFolder)?.name ?? 'raíz'}`}
          aria-label="Nombre de la nueva carpeta"
          maxLength={120}
        />
        <Button type="submit" disabled={busy || !newFolderName.trim()} className="shrink-0">
          Crear carpeta
        </Button>
      </form>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDrop(event, '')}
        className="rounded-xl border border-dashed p-4"
      >
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Folder className="size-4 text-primary" /> Archivos en el VPS
        </h3>
        {files.length ? (
          <ul className="divide-y max-h-96 overflow-y-auto">
            {files.map((file) => (
              <li
                key={file.path}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/vps-library-file', file.path)}
                className="flex cursor-grab items-center gap-3 py-3 active:cursor-grabbing hover:bg-secondary/30 transition-colors"
                title="Arrastrá este archivo a una carpeta para moverlo"
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
                <span className="hidden sm:block max-w-48 truncate text-xs text-muted-foreground">
                  {file.folder || 'Raíz'}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground hidden sm:block">{formatBytes(file.size)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1 h-7 px-2"
                  disabled={busy}
                  onClick={() => renameFile(file.path, file.name)}
                  title="Renombrar archivo"
                >
                  <Pencil className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {snapshot ? 'Todavía no hay archivos. Podés subir varios a la vez.' : 'Cargando biblioteca…'}
          </p>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm">{notice}</p>}
      {uploading && <p role="status" className="text-sm text-muted-foreground">{uploading}</p>}
      {busy && <span className="sr-only" aria-live="polite">Guardando cambios…</span>}
    </div>
  )
}
