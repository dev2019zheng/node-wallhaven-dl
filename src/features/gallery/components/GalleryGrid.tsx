import { useState } from "react"

import type { GalleryView } from "@/features/shell/ui-shell-store"
import { cn } from "@/lib/utils"

import { GalleryCard, type GalleryCardItem } from "./GalleryCard"
import { GalleryPreviewLightbox } from "./GalleryPreviewLightbox"

export type GalleryGridItem = GalleryCardItem

type GalleryGridProps = {
  items: GalleryGridItem[]
  view: GalleryView
}

export function GalleryGrid({ items, view }: GalleryGridProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const openPreview = (index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
  }

  return (
    <>
      <div
        className={cn(
          view === "grid" ? "grid gap-4 md:grid-cols-2 2xl:grid-cols-3" : "space-y-4",
        )}
      >
        {items.map((item, index) => (
          <GalleryCard
            item={item}
            key={item.wallpaperId}
            onPreview={() => openPreview(index)}
            view={view}
          />
        ))}
      </div>

      <GalleryPreviewLightbox
        index={previewIndex}
        items={items}
        onClose={() => setPreviewOpen(false)}
        onView={setPreviewIndex}
        open={previewOpen}
      />
    </>
  )
}
