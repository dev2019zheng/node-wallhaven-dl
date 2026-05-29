import type { GalleryView } from "@/features/shell/ui-shell-store"

type GallerySidebarProps = {
  archivedCount: number
  loadedCount: number
  visibleCount: number
  view: GalleryView
  hasActiveSearch: boolean
}

export function GallerySidebar({
  archivedCount,
  loadedCount,
  visibleCount,
  view,
  hasActiveSearch,
}: GallerySidebarProps) {
  return (
    <aside
      aria-label="Gallery sidebar"
      className="space-y-4 rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm"
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Workspace</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          The gallery stays backed by the Rust archive command. This sidebar only surfaces the local
          signals the client already has.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Loaded now
          </dt>
          <dd className="mt-2 text-xl font-semibold text-foreground">{loadedCount}</dd>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Archived total
          </dt>
          <dd className="mt-2 text-xl font-semibold text-foreground">{archivedCount}</dd>
        </div>
        <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Layout
          </dt>
          <dd className="mt-2 text-xl font-semibold text-foreground">
            {view === "grid" ? "Grid" : "Compact"}
          </dd>
        </div>
      </dl>

      <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Collections
        </p>
        <ul className="space-y-3 text-sm text-foreground">
          <li className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
            <span>All archived</span>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
              {visibleCount}
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/60 px-3 py-2 text-muted-foreground">
            <span>Local search</span>
            <span className="text-xs font-medium uppercase tracking-[0.18em]">
              {hasActiveSearch ? "Active" : "Off"}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-border/80 bg-background/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Metadata currently shown
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Cards stay grounded in the archive fields already returned today: filename, wallpaper id,
          saved path, source link, and archived timestamp. Extra file metadata remains hidden until
          the gallery command provides it.
        </p>
      </div>
    </aside>
  )
}
