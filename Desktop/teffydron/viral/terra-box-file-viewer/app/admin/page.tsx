import type { Metadata } from 'next'
import Link from 'next/link'
import {
  FolderOpen, Eye, EyeOff, Pin, Users, Settings,
  BarChart2, FileVideo, MessageSquare, Trash2, HardDrive,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SignOutButton } from '@/components/sign-out-button'
import { VisibilityToggle, PinToggle } from '@/components/admin/folder-toggle'
import { UserRoleSelect } from '@/components/admin/user-role-select'
import { AddFolderForm } from '@/components/admin/add-folder-form'
import { VpsLibraryManager } from '@/components/admin/vps-library-manager'
import { VideoSyncCounter } from '@/components/admin/video-sync-counter'
import { requireAdmin, getFolderConfigs, getVideoSyncOverview } from '@/lib/admin'
import { listUsers, deleteFolderConfig } from '@/app/actions/admin'
import { listFiles } from '@/lib/terabox'

export const metadata: Metadata = { title: 'Administración | TefyDron' }

function formatBytes(bytes: number) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

function syncStatusLabel(status: string) {
  return {
    running: 'En curso',
    complete: 'Completada',
    partial: 'Parcial: se alcanzó el límite de almacenamiento',
    error: 'Con errores',
  }[status] ?? status
}

async function getTeraboxFolders() {
  try {
    const files = await listFiles('/')
    return files.filter((f) => f.isDir)
  } catch {
    return []
  }
}

export default async function AdminPage() {
  const viewer = await requireAdmin()

  const [configs, users, rootFolders, sync] = await Promise.all([
    getFolderConfigs(),
    listUsers(),
    getTeraboxFolders(),
    getVideoSyncOverview(),
  ])

  // Index configs by path for quick lookup
  const configByPath = new Map(configs.map((c) => [c.path, c]))

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader title="Panel de administración" subtitle="TefyDron · Gestión de contenido y usuarios" />

      <main className="mx-auto max-w-7xl px-4 py-8 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">

        {/* ── Sidebar ── */}
        <aside className="mb-8 lg:mb-0 lg:sticky lg:top-6 lg:self-start flex flex-col gap-3">
          <nav className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-3 py-2 text-xs font-bold tracking-widest text-muted-foreground uppercase border-b border-border">
              Admin
            </div>
            <div className="flex flex-col p-2 gap-0.5">
              <a href="#carpetas" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-primary/10 text-primary">
                <FolderOpen className="size-4" /> Carpetas
              </a>
              <a href="#biblioteca-vps" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <HardDrive className="size-4" /> Biblioteca VPS
              </a>
              <a href="#usuarios" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <Users className="size-4" /> Usuarios
              </a>
            </div>
            <div className="px-3 py-2 text-xs font-bold tracking-widest text-muted-foreground uppercase border-t border-b border-border">
              Ir a
            </div>
            <div className="flex flex-col p-2 gap-0.5">
              <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <BarChart2 className="size-4" /> Dashboard
              </Link>
              <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <FileVideo className="size-4" /> Videoteca
              </Link>
              <Link href="/comunidad" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <MessageSquare className="size-4" /> Foro
              </Link>
            </div>
            <div className="p-2 border-t border-border">
              <SignOutButton className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-left" />
            </div>
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex flex-col gap-10">

          <section id="sincronizacion" className="flex flex-col gap-4">
            <h2 className="font-serif text-xl font-bold flex items-center gap-2">
              <HardDrive className="size-5 text-primary" />
              Copia de videos en el servidor
            </h2>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">
                La videoteca visible se sincroniza una vez al día. Las copias se conservan aunque el video deje de estar en TeraBox.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Videos guardados</p>
                  <p className="text-lg font-semibold">{sync.cachedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Espacio usado</p>
                  <p className="text-lg font-semibold">{formatBytes(sync.cachedBytes)} / 70 GB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendientes o con error</p>
                  <p className="text-lg font-semibold">{sync.attentionCount}</p>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <VideoSyncCounter
                  initialCount={sync.downloadingCount}
                  initialBytes={sync.downloadingBytes}
                  initialCachedBytes={sync.cachedBytes}
                  initialQueue={sync.syncQueue}
                  initialDownloaded={sync.downloadedVideos}
                />
              </div>
              {sync.lastRun ? (
                <div className="mt-4 border-t border-border pt-3 text-sm">
                  <p>
                    Último intento: {syncStatusLabel(sync.lastRun.status)} ·{' '}
                    {new Date(sync.lastRun.startedAt).toLocaleString('es-AR')}
                  </p>
                  {sync.lastRun.error && (
                    <p className="mt-1 text-destructive">{sync.lastRun.error}</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                  La primera sincronización todavía no comenzó.
                </p>
              )}
            </div>
          </section>

          <section id="biblioteca-vps" className="flex flex-col gap-4">
            <h2 className="font-serif text-xl font-bold flex items-center gap-2">
              <HardDrive className="size-5 text-primary" />
              Biblioteca local del VPS
            </h2>
            <p className="text-sm text-muted-foreground -mt-2">
              Creá carpetas, subí varios videos, imágenes o audios, cambiá portadas y arrastrá archivos a otra carpeta. El contenido aparece en la videoteca pública y comparte el límite de 70 GB.
            </p>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <VpsLibraryManager />
            </div>
          </section>

          {/* ── Carpetas de TeraBox ── */}
          <section id="carpetas" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold flex items-center gap-2">
                <FolderOpen className="size-5 text-primary" />
                Carpetas de TeraBox
              </h2>
              <AddFolderForm />
            </div>
            <p className="text-sm text-muted-foreground -mt-2">
              Controlá qué carpetas aparecen en la videoteca pública. Las carpetas no configuradas se muestran por defecto.
            </p>

            {/* Root folders detected from TeraBox */}
            {rootFolders.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Carpetas raíz detectadas en TeraBox</span>
                </div>
                <ul className="divide-y divide-border">
                  {rootFolders.map((folder) => {
                    const cfg = configByPath.get(folder.path)
                    const visible = cfg ? cfg.visible : true
                    const pinned = cfg?.pinned ?? false
                    // No mostrar carpetas ocultas en el panel de admin
                    if (!visible) return null
                    return (
                      <li key={folder.path} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{folder.path}</p>
                          {cfg?.label && <p className="text-xs text-accent-foreground">{cfg.label}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <VisibilityToggle path={folder.path} visible={visible} />
                          <PinToggle path={folder.path} pinned={pinned} />
                          <Link
                            href={`/?dir=${encodeURIComponent(folder.path)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
                            target="_blank"
                          >
                            <FileVideo className="size-3.5" />
                            Ver
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Custom configured folders */}
            {configs.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
                  <Settings className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Carpetas configuradas manualmente</span>
                </div>
                <ul className="divide-y divide-border">
                  {configs.map((cfg) => {
                    // No mostrar carpetas ocultas en el panel de admin
                    if (!cfg.visible) return null
                    return (
                      <li key={cfg.path} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cfg.label || cfg.path.split('/').pop()}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cfg.path}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <VisibilityToggle path={cfg.path} visible={cfg.visible} />
                          <PinToggle path={cfg.path} pinned={cfg.pinned} />
                          <Link
                            href={`/?dir=${encodeURIComponent(cfg.path)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
                            target="_blank"
                          >
                            <FileVideo className="size-3.5" />
                            Ver
                          </Link>
                          <form action={deleteFolderConfig.bind(null, cfg.path)}>
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                              title="Eliminar configuración"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </form>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {rootFolders.length === 0 && configs.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No se detectaron carpetas en TeraBox. Verificá la cookie NDUS o agregá una ruta manualmente.
              </div>
            )}
          </section>

          {/* ── Usuarios ── */}
          <section id="usuarios" className="flex flex-col gap-4">
            <h2 className="font-serif text-xl font-bold flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Usuarios registrados
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {users.length}
              </span>
            </h2>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Nombre</span>
                <span>Email</span>
                <span>Registro</span>
                <span>Rol</span>
              </div>
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 sm:gap-4 items-center px-5 py-3 hover:bg-secondary/30 transition-colors">
                    <span className="text-sm font-medium">{u.name}</span>
                    <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-AR') : '—'}
                    </span>
                    <UserRoleSelect userId={u.id} role={u.role ?? 'user'} selfId={viewer.id} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
