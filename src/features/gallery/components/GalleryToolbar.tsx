import { Button } from "@/components/ui/button"
import type { GalleryView } from "@/features/shell/ui-shell-store"
import { cn } from "@/lib/utils"

type GalleryToolbarProps = {
  query: string
  view: GalleryView
  visibleCount: number
  totalCount: number
  disabled?: boolean
  onQueryChange: (value: string) => void
  onViewChange: (view: GalleryView) => void
}

function getResultsLabel(query: string, visibleCount: number, totalCount: number): string {
  if (totalCount === 0) {
    return "Archive is empty"
  }

  if (query.trim()) {
    return `Showing ${visibleCount} of ${totalCount} loaded`
  }

  return `${visibleCount} loaded`
}

export function GalleryToolbar({
  query,
  view,
  visibleCount,
  totalCount,
  disabled = false,
  onQueryChange,
  onViewChange,
}: GalleryToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-background/70 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <input
          aria-label="Search local gallery"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onChange={(event) => {
            onQueryChange(event.currentTarget.value)
          }}
          placeholder="Search file name, wallpaper id, or saved path"
          type="search"
          value={query}
        />
        <div
          aria-live="polite"
          className="inline-flex h-11 items-center rounded-full border border-border/80 bg-card/60 px-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          {getResultsLabel(query, visibleCount, totalCount)}
        </div>
      </div>

      <div aria-label="Gallery view" className="flex items-center gap-2" role="group">
        <Button
          aria-pressed={view === "grid"}
          className={cn(view === "grid" ? "shadow-sm" : "")}
          disabled={disabled}
          onClick={() => {
            onViewChange("grid")
          }}
          size="sm"
          type="button"
          variant={view === "grid" ? "default" : "outline"}
        >
          Grid view
        </Button>
        <Button
          aria-pressed={view === "compact"}
          className={cn(view === "compact" ? "shadow-sm" : "")}
          disabled={disabled}
          onClick={() => {
            onViewChange("compact")
          }}
          size="sm"
          type="button"
          variant={view === "compact" ? "default" : "outline"}
        >
          Compact view
        </Button>
      </div>
    </div>
  )
}
