import { Download, Eye, Heart } from "lucide-react";

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
    <article
      className={`group overflow-hidden rounded-2xl border bg-card/92 shadow-[0_18px_40px_rgb(2_6_23_/_0.18)] transition ${
        isSelected ? "border-primary/60 ring-1 ring-primary/35" : "border-border/85"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-background/70">
        <img
          alt={`Wallpaper ${wallpaper.id}`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          src={wallpaper.thumbs.large}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/55 via-black/10 to-transparent px-3 py-3 opacity-0 transition duration-200 group-hover:opacity-100">
          <label className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            <input
              aria-label={`Select wallpaper ${wallpaper.id}`}
              checked={isSelected}
              className="h-4 w-4 rounded border-white/30 bg-transparent"
              disabled={isSelectionDisabled}
              onChange={(event) => {
                onToggleSelection?.(event.currentTarget.checked);
              }}
              type="checkbox"
            />
            <span>选择</span>
          </label>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              aria-label={`Favorite wallpaper ${wallpaper.id}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/40 text-white/85 backdrop-blur transition hover:text-white"
              type="button"
            >
              <Heart className="h-4 w-4" />
            </button>
            <button
              aria-label={`Preview wallpaper ${wallpaper.id}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/40 text-white/85 backdrop-blur transition hover:text-white"
              onClick={onPreview}
              type="button"
            >
              <Eye className="h-4 w-4" />
            </button>
            {onDownload ? (
              <button
                aria-label={`Download wallpaper ${wallpaper.id}`}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDownloading}
                onClick={onDownload}
                type="button"
              >
                <Download className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/72 via-black/28 to-transparent px-4 py-3 text-white">
          <div>
            <p className="text-sm font-semibold tracking-tight">{wallpaper.resolution}</p>
            <p className="mt-1 text-xs text-white/80">{wallpaper.ratio} · {wallpaper.category}</p>
          </div>
          <a
            aria-label={`Open wallpaper ${wallpaper.id}`}
            className="text-xs font-medium text-white/80 transition hover:text-white"
            href={wallpaper.shortUrl}
            rel="noreferrer"
            target="_blank"
          >
            {isDownloading ? "下载中" : "查看详情"}
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{wallpaper.views.toLocaleString()} 次查看</span>
          <span>{wallpaper.favorites.toLocaleString()} 收藏</span>
        </div>
        <Button onClick={onPreview} size="sm" type="button" variant="ghost">
          预览
        </Button>
      </div>
    </article>
  );
}
