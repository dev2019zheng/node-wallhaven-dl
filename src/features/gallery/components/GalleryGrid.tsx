import { useState } from "react"

import type { GalleryView } from "@/features/shell/ui-shell-store"
import { cn } from "@/lib/utils"

import { GalleryCard, type GalleryCardItem } from "./GalleryCard"
import { GalleryPreviewLightbox } from "./GalleryPreviewLightbox"

export type GalleryGridItem = GalleryCardItem

type GalleryGridProps = {
  items: GalleryGridItem[]
  view: GalleryView
  selectedWallpaperId?: string | null
  onSelect?: (item: GalleryGridItem) => void
  onTag?: (item: GalleryGridItem) => void
  onToggleFavorite?: (item: GalleryGridItem) => void
}

export function GalleryGrid({
  items,
  view,
  selectedWallpaperId,
  onSelect,
  onTag,
  onToggleFavorite,
}: GalleryGridProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const openPreview = (index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
  }
  const viewPreview = (index: number) => {
    setPreviewIndex(index)
    const item = items[index]
    if (item) {
      onSelect?.(item)
    }
  }

  return (
    <>
      <div
        className={cn(
          view === "grid"
            ? "grid max-h-[calc(100vh-418px)] min-h-[282px] grid-cols-1 gap-x-4 gap-y-[18px] overflow-y-auto pr-1 sm:grid-cols-2 min-[1400px]:grid-cols-3"
            : "max-h-[calc(100vh-418px)] min-h-[282px] space-y-4 overflow-y-auto pr-1",
        )}
        style={view === "grid" ? { contentVisibility: "auto", containIntrinsicSize: "716px 420px" } : undefined}
      >
        {items.map((item, index) => (
          <GalleryCard
            isSelected={item.wallpaperId === selectedWallpaperId}
            item={item}
            key={item.wallpaperId}
            onPreview={() => {
              onSelect?.(item)
              openPreview(index)
            }}
            onSelect={() => {
              onSelect?.(item)
            }}
            onTag={() => {
              onTag?.(item)
            }}
            onToggleFavorite={() => {
              onToggleFavorite?.(item)
            }}
            view={view}
          />
        ))}
      </div>

      <GalleryPreviewLightbox
        index={previewIndex}
        items={items}
        onClose={() => setPreviewOpen(false)}
        onView={viewPreview}
        open={previewOpen}
      />
    </>
  )
}
