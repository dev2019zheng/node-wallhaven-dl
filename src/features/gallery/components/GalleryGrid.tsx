import { useState } from "react"

import type { GalleryItem } from "@/application/gallery/gallery.types"

import { GalleryPreviewLightbox } from "./GalleryPreviewLightbox"

export type GalleryGridItem = GalleryItem & {
  assetUrl: string
}

export function GalleryGrid({ items }: { items: GalleryGridItem[] }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  const openPreview = (index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((item, index) => (
          <article
            className="overflow-hidden rounded-3xl border border-border/80 bg-background/80 shadow-sm"
            key={item.wallpaperId}
          >
            <button
              className="block aspect-[4/3] w-full overflow-hidden bg-card/60"
              onClick={() => openPreview(index)}
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-foreground">
                    {item.fileName}
                  </h4>
                  <p className="text-xs text-muted-foreground">{item.wallpaperId}</p>
                </div>
                <button
                  className="text-xs font-medium text-foreground transition hover:text-sky-200"
                  onClick={() => openPreview(index)}
                  type="button"
                >
                  Preview wallpaper {item.wallpaperId}
                </button>
              </div>

              <dl className="grid gap-2 text-xs text-muted-foreground">
                <div className="rounded-2xl border border-border/80 bg-card/40 px-3 py-2">
                  <dt className="font-semibold uppercase tracking-[0.2em] text-sky-200">
                    Saved path
                  </dt>
                  <dd className="mt-2 break-all text-foreground/90">{item.relativeFilePath}</dd>
                </div>
                <div className="rounded-2xl border border-border/80 bg-card/40 px-3 py-2">
                  <dt className="font-semibold uppercase tracking-[0.2em] text-sky-200">
                    Archived at
                  </dt>
                  <dd className="mt-2 text-foreground/90">{item.createdAt}</dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                  Local asset
                </span>
                <a
                  className="text-xs font-medium text-sky-300 transition hover:text-sky-200"
                  href={item.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source
                </a>
              </div>
            </div>
          </article>
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
