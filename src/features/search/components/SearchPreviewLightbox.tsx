import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"
import { useEffect } from "react"

import type { SearchWallpaper } from "@/application/search/search.types"
import { ProxiedImage } from "@/components/proxied-image"

type SearchPreviewLightboxProps = {
  wallpapers: SearchWallpaper[]
  index: number
  open: boolean
  onClose: () => void
  onView: (index: number) => void
}

export function SearchPreviewLightbox({
  wallpapers,
  index,
  open,
  onClose,
  onView,
}: SearchPreviewLightboxProps) {
  const wallpaper = wallpapers[index]
  const canGoPrevious = index > 0
  const canGoNext = index < wallpapers.length - 1

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }

      if (event.key === "ArrowLeft" && canGoPrevious) {
        onView(index - 1)
      }

      if (event.key === "ArrowRight" && canGoNext) {
        onView(index + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canGoNext, canGoPrevious, index, onClose, onView, open])

  if (!open || !wallpaper) {
    return null
  }

  return (
    <div
      aria-label={`Preview wallpaper ${wallpaper.id}`}
      aria-modal="true"
      className="fixed inset-0 z-50 grid grid-rows-[72px_minmax(0,1fr)_84px] bg-[#03070d]/94 backdrop-blur-xl"
      data-testid="lightbox"
      role="dialog"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-8">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{wallpaper.id}</p>
          <p className="mt-1 text-[12px] font-medium text-white/58">
            {wallpaper.resolution} · {(wallpaper.fileSize / 1024 / 1024).toFixed(1)} MB · {wallpaper.purity.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            className="wh-icon-button h-10 w-10"
            href={wallpaper.url}
            rel="noreferrer"
            target="_blank"
            title="Open Wallhaven page"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            aria-label="Close preview"
            className="wh-icon-button h-10 w-10"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-4 px-6 py-5">
        <button
          aria-label="Previous wallpaper"
          className="wh-icon-button h-12 w-12 justify-self-center disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canGoPrevious}
          onClick={() => onView(index - 1)}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black/30">
          <ProxiedImage
            alt={`Wallpaper ${wallpaper.id}`}
            className="max-h-full max-w-full object-contain"
            src={wallpaper.path}
          />
        </div>

        <button
          aria-label="Next wallpaper"
          className="wh-icon-button h-12 w-12 justify-self-center disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canGoNext}
          onClick={() => onView(index + 1)}
          type="button"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-8">
        <p className="max-w-[70vw] truncate text-[12px] font-medium text-white/58">{wallpaper.path}</p>
        <p className="text-[12px] font-semibold text-white/70">
          {index + 1} / {wallpapers.length}
        </p>
      </div>
    </div>
  )
}
