import type { SearchWallpaper } from "@/application/search/search.types"
import { Button } from "@/components/ui/button"

export function SearchResultCard({
  wallpaper,
  onDownload,
  onPreview,
  isDownloading = false,
}: {
  wallpaper: SearchWallpaper
  onDownload?: () => void
  onPreview: () => void
  isDownloading?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm">
      <div className="aspect-[4/3] overflow-hidden bg-card/60">
        <img
          alt={`Wallpaper ${wallpaper.id}`}
          className="h-full w-full object-cover"
          loading="lazy"
          src={wallpaper.thumbs.large}
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{wallpaper.id}</h4>
            <p className="text-xs text-muted-foreground">{wallpaper.resolution}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onDownload ? (
              <Button
                aria-label={`Download wallpaper ${wallpaper.id}`}
                disabled={isDownloading}
                onClick={onDownload}
                size="sm"
                type="button"
                variant="outline"
              >
                {isDownloading ? "Downloading..." : "Download"}
              </Button>
            ) : null}
            <button
              className="text-xs font-medium text-foreground transition hover:text-sky-200"
              onClick={onPreview}
              type="button"
            >
              Preview wallpaper {wallpaper.id}
            </button>
            <a
              className="text-xs font-medium text-sky-300 transition hover:text-sky-200"
              href={wallpaper.shortUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/80 px-2 py-1">
            {wallpaper.category}
          </span>
          <span className="rounded-full border border-border/80 px-2 py-1">
            {wallpaper.purity}
          </span>
          <span className="rounded-full border border-border/80 px-2 py-1">
            {wallpaper.fileType}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <p>{wallpaper.favorites} favorites</p>
          <p>{wallpaper.views} views</p>
          <p>
            {wallpaper.dimensionX}×{wallpaper.dimensionY}
          </p>
          <p>{wallpaper.ratio} ratio</p>
        </div>
      </div>
    </article>
  )
}
