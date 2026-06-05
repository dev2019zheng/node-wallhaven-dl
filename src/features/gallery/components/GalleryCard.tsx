import { Heart, MoreHorizontal, Tag } from "lucide-react"

import type { GalleryItem } from "@/application/gallery/gallery.types"
import type { GalleryView } from "@/features/shell/ui-shell-store"
import { cn } from "@/lib/utils"

export type GalleryCardItem = GalleryItem & {
  assetUrl: string
}

type GalleryCardProps = {
  item: GalleryCardItem
  view: GalleryView
  isSelected?: boolean
  onPreview: () => void
  onSelect?: () => void
  onTag?: () => void
  onToggleFavorite?: () => void
}

export function GalleryCard({
  item,
  view,
  isSelected = false,
  onPreview,
  onSelect,
  onTag,
  onToggleFavorite,
}: GalleryCardProps) {
  return (
    <article
      className={cn(
        "group relative h-[132px] overflow-hidden rounded-[16px] border bg-[var(--surface-deep)] transition duration-150 hover:-translate-y-0.5 hover:border-primary",
        isSelected ? "border-[3px] border-primary" : "border-border",
        view === "list" ? "grid grid-cols-[220px_minmax(0,1fr)]" : "",
      )}
      data-view={view}
    >
      <button
        className={cn(
          "block h-full w-full overflow-hidden bg-card/60",
          view === "list" ? "" : "absolute inset-0",
        )}
        onClick={() => {
          onSelect?.()
          onPreview()
        }}
        type="button"
      >
        <img
          alt={`Wallpaper ${item.wallpaperId}`}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
          loading="lazy"
          src={item.assetUrl}
        />
      </button>

      <div className={cn("pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/76 via-black/18 to-black/12", view === "list" ? "left-[220px] bg-none" : "")}>
        <div className="wh-image-pill absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold">
          {(item.purity ?? "sfw").toUpperCase()}
        </div>
        <button
          aria-label={`Favorite wallpaper ${item.wallpaperId}`}
          className="wh-image-button pointer-events-auto absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
          onClick={() => {
            onSelect?.()
            onToggleFavorite?.()
          }}
          type="button"
        >
          <Heart className={cn("h-4 w-4", item.isFavorite ? "fill-current text-rose-300" : "")} />
        </button>

        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
          <button
            className="pointer-events-auto min-w-0 text-left"
            onClick={onSelect}
            type="button"
          >
            <span className="block truncate text-[13px] font-semibold text-white">{item.fileName}</span>
            <span className="mt-1 block truncate text-[11px] text-white/70">{item.wallpaperId} · {item.category ?? "general"}</span>
          </button>

          <div className="pointer-events-auto flex translate-y-7 items-center gap-2 opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              aria-label={`Tag wallpaper ${item.wallpaperId}`}
              className="wh-icon-button h-8 w-8"
              onClick={() => {
                onSelect?.()
                onTag?.()
              }}
              type="button"
            >
              <Tag className="h-4 w-4" />
            </button>
            <button
              aria-label={`Preview wallpaper ${item.wallpaperId}`}
              className="wh-icon-button h-8 w-8"
              onClick={() => {
                onSelect?.()
                onPreview()
              }}
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <span className="sr-only">{item.relativeFilePath}</span>
      <span className="sr-only">{item.createdAt}</span>
    </article>
  )
}
