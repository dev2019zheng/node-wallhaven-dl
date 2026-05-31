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
    return "暂无归档壁纸"
  }

  if (query.trim()) {
    return `显示 ${visibleCount} / ${totalCount}`
  }

  return `已载入 ${visibleCount} 张`
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
    <div className="flex flex-col gap-4 rounded-2xl border border-border/85 bg-background/55 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <input
          aria-label="Search local gallery"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          onChange={(event) => {
            onQueryChange(event.currentTarget.value)
          }}
          placeholder="搜索本地壁纸"
          type="search"
          value={query}
        />
        <div
          aria-live="polite"
          className="inline-flex h-11 items-center rounded-full border border-border bg-card/60 px-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          {getResultsLabel(query, visibleCount, totalCount)}
        </div>
      </div>

      <div aria-label="Gallery view" className="flex items-center gap-2" role="group">
        <Button
          aria-pressed={view === "grid"}
          className={cn(view === "grid" ? "rounded-xl shadow-sm" : "rounded-xl")}
          disabled={disabled}
          onClick={() => {
            onViewChange("grid")
          }}
          size="sm"
          type="button"
          variant={view === "grid" ? "default" : "outline"}
        >
          网格视图
        </Button>
        <Button
          aria-pressed={view === "compact"}
          className={cn(view === "compact" ? "rounded-xl shadow-sm" : "rounded-xl")}
          disabled={disabled}
          onClick={() => {
            onViewChange("compact")
          }}
          size="sm"
          type="button"
          variant={view === "compact" ? "default" : "outline"}
        >
          紧凑视图
        </Button>
      </div>
    </div>
  )
}
