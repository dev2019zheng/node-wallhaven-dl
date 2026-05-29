import type { SearchWallpaper } from "@/application/search/search.types";
import { Button } from "@/components/ui/button";

type WallpaperCardProps = {
  wallpaper: SearchWallpaper;
  onDownload?: () => void;
  onPreview: () => void;
  onToggleSelection?: (checked: boolean) => void;
  isDownloading?: boolean;
  isSelected?: boolean;
  isSelectionDisabled?: boolean;
};

export function WallpaperCard({
  wallpaper,
  onDownload,
  onPreview,
  onToggleSelection,
  isDownloading = false,
  isSelected = false,
  isSelectionDisabled = false,
}: WallpaperCardProps) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            aria-label={`Select wallpaper ${wallpaper.id}`}
            checked={isSelected}
            className="h-4 w-4 rounded border-border/80"
            disabled={isSelectionDisabled}
            onChange={(event) => {
              onToggleSelection?.(event.currentTarget.checked);
            }}
            type="checkbox"
          />
          <span>Select</span>
        </label>
        <div className="shrink-0 rounded-full border border-border/80 px-2.5 py-1 text-xs text-muted-foreground">
          {wallpaper.fileType}
        </div>
      </div>

      <div className="aspect-[16/10] overflow-hidden bg-card/60">
        <img
          alt={`Wallpaper ${wallpaper.id}`}
          className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
          loading="lazy"
          src={wallpaper.thumbs.large}
        />
      </div>

      <div className="space-y-4 p-4">
        <div className="min-w-0 space-y-1">
          <h4 className="truncate text-base font-semibold text-foreground">{wallpaper.id}</h4>
          <p className="text-sm text-muted-foreground">Ready for preview and download.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/80 px-2 py-1">{wallpaper.category}</span>
          <span className="rounded-full border border-border/80 px-2 py-1">{wallpaper.purity}</span>
          <span className="rounded-full border border-border/80 px-2 py-1">
            {wallpaper.dimensionX}×{wallpaper.dimensionY}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Resolution</p>
            <p className="mt-1 font-medium text-foreground">{wallpaper.resolution}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ratio</p>
            <p className="mt-1 font-medium text-foreground">{wallpaper.ratio}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Favorites</p>
            <p className="mt-1 font-medium text-foreground">{wallpaper.favorites}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Views</p>
            <p className="mt-1 font-medium text-foreground">{wallpaper.views}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onDownload ? (
            <Button
              aria-label={`Download wallpaper ${wallpaper.id}`}
              className="min-w-[9rem]"
              disabled={isDownloading}
              onClick={onDownload}
              type="button"
            >
              {isDownloading ? "Downloading..." : "Download"}
            </Button>
          ) : null}
          <Button
            aria-label={`Preview wallpaper ${wallpaper.id}`}
            onClick={onPreview}
            size="sm"
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          <a
            aria-label={`Open wallpaper ${wallpaper.id}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border/80 px-3 text-sm font-medium text-sky-300 transition hover:border-sky-400/40 hover:text-sky-200"
            href={wallpaper.shortUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open
          </a>
        </div>
      </div>
    </article>
  );
}
