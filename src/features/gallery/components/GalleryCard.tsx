import type { GalleryItem } from "@/application/gallery/gallery.types"
import type { GalleryView } from "@/features/shell/ui-shell-store"
import { cn } from "@/lib/utils"

export type GalleryCardItem = GalleryItem & {
  assetUrl: string
}

type GalleryCardProps = {
  item: GalleryCardItem
  view: GalleryView
  onPreview: () => void
}

export function GalleryCard({ item, view, onPreview }: GalleryCardProps) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm",
        view === "compact" ? "sm:grid sm:grid-cols-[15rem_minmax(0,1fr)]" : "",
      )}
      data-view={view}
    >
      <button
        className={cn(
          "block overflow-hidden bg-card/60",
          view === "grid" ? "aspect-[4/3] w-full" : "aspect-[4/3] w-full sm:h-full",
        )}
        onClick={onPreview}
        type="button"
      >
        <img
          alt={`Wallpaper ${item.wallpaperId}`}
          className="h-full w-full object-cover"
          loading="lazy"
          src={item.assetUrl}
        />
      </button>

      <div className="space-y-3 p-4">
        <div
          className={cn(
            "flex gap-3",
            view === "compact"
              ? "flex-col lg:flex-row lg:items-start lg:justify-between"
              : "items-start justify-between",
          )}
        >
          <div className="min-w-0 space-y-1">
            <h4 className="truncate text-sm font-semibold text-foreground">{item.fileName}</h4>
            <p className="text-xs text-muted-foreground">{item.wallpaperId}</p>
          </div>
          <button
            className="text-left text-xs font-medium text-foreground transition hover:text-sky-700 dark:hover:text-sky-200"
            onClick={onPreview}
            type="button"
          >
            Preview wallpaper {item.wallpaperId}
          </button>
        </div>

        <dl className={cn("grid gap-2 text-xs text-muted-foreground", view === "compact" ? "lg:grid-cols-2" : "") }>
          <div className="rounded-2xl border border-border/80 bg-card/40 px-3 py-2">
            <dt className="font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
              Saved path
            </dt>
            <dd className="mt-2 break-all text-foreground/90">{item.relativeFilePath}</dd>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/40 px-3 py-2">
            <dt className="font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
              Archived at
            </dt>
            <dd className="mt-2 text-foreground/90">{item.createdAt}</dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            Local asset
          </span>
          <a
            className="text-xs font-medium text-sky-700 transition hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200"
            href={item.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open source
          </a>
        </div>
      </div>
    </article>
  )
}
