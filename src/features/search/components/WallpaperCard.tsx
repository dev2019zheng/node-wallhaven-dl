import { Download, Eye, Heart } from "lucide-react";

import type { SearchWallpaper } from "@/application/search/search.types";
import { ProxiedImage } from "@/components/proxied-image";

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
    <article
      className={`group relative h-[156px] overflow-hidden rounded-2xl border bg-[var(--surface-deep)] transition duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--card-hover-shadow)] ${
        isSelected ? "border-[3px] border-primary" : "border-border"
      }`}
    >
      <div className="relative h-full overflow-hidden bg-background/70">
        <ProxiedImage
          alt={`Wallpaper ${wallpaper.id}`}
          className="h-full w-full object-cover transition duration-150 group-hover:scale-[1.035]"
          loading="lazy"
          src={wallpaper.thumbs.large}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 via-black/10 to-transparent px-3 py-3">
          <span className="wh-image-pill rounded-full px-3 py-1 text-[11px] font-semibold">
            {wallpaper.resolution}
          </span>

          <label className="wh-image-button pointer-events-auto relative flex h-8 w-8 items-center justify-center rounded-full">
            <input
              aria-label={`Select wallpaper ${wallpaper.id}`}
              checked={isSelected}
              className="peer absolute inset-0 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
              disabled={isSelectionDisabled}
              onChange={(event) => {
                onToggleSelection?.(event.currentTarget.checked);
              }}
              type="checkbox"
            />
            {isSelected ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white peer-disabled:opacity-60">
                ✓
              </span>
            ) : (
              <Heart className="h-4 w-4 peer-disabled:opacity-60" />
            )}
          </label>
        </div>

        <button
          aria-label={`Open wallpaper ${wallpaper.id}`}
          className="absolute inset-0 z-0"
          onClick={onPreview}
          type="button"
        />

        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-black/78 via-black/30 to-transparent px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight">{wallpaper.id}</p>
              <p className="mt-1 text-[11px] text-white/70">{wallpaper.ratio} · {wallpaper.category}</p>
              <span className="sr-only">{wallpaper.favorites}</span>
              <span className="sr-only">Favorites</span>
              <span className="sr-only">{wallpaper.views}</span>
              <span className="sr-only">Views</span>
            </div>

          <div className="flex translate-y-8 items-center gap-2 opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              aria-label={`Preview wallpaper ${wallpaper.id}`}
              className="wh-image-button flex h-8 w-8 items-center justify-center rounded-full"
              onClick={onPreview}
              type="button"
            >
              <Eye className="h-4 w-4" />
            </button>
            {onDownload ? (
              <button
                aria-label={`Download wallpaper ${wallpaper.id}`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDownloading}
                onClick={onDownload}
                type="button"
              >
                <Download className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
