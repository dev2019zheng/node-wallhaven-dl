import type { SearchWallpaper } from "@/application/search/search.types";
import { Button } from "@/components/ui/button";

type SearchResultCardProps = {
  wallpaper: SearchWallpaper;
  onDownload?: () => void;
  onPreview: () => void;
  isDownloading?: boolean;
};

export function SearchResultCard({
  wallpaper,
  onDownload,
  onPreview,
  isDownloading = false,
}: SearchResultCardProps) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm">
      <div className="aspect-[16/10] overflow-hidden bg-card/60">
        <img
          alt={`Wallpaper ${wallpaper.id}`}
          className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
          loading="lazy"
          src={wallpaper.thumbs.large}
        />
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h4 className="truncate text-base font-semibold text-foreground">{wallpaper.id}</h4>
            <p className="text-sm text-muted-foreground">{wallpaper.resolution}</p>
          </div>
          <div className="shrink-0 rounded-full border border-border/80 px-2.5 py-1 text-xs text-muted-foreground">
            {wallpaper.fileType}
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
            {wallpaper.dimensionX}×{wallpaper.dimensionY}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-200">Favorites</p>
            <p className="mt-1 font-medium text-foreground">{wallpaper.favorites}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-200">Views</p>
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
