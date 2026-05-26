import { convertFileSrc } from "@tauri-apps/api/core"
import { useEffect, useMemo, useState } from "react"

import { loadInitialGalleryItems } from "@/application/gallery/gallery-service"
import type { GalleryListResponse } from "@/application/gallery/gallery.types"

import { GalleryGrid } from "./components/GalleryGrid"

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const start = async () => {
      setIsLoading(true)

      try {
        const response = await loadInitialGalleryItems()
        if (!isActive) {
          return
        }

        setGallery(response)
        setLoadError(null)
      } catch (error) {
        if (!isActive) {
          return
        }

        setLoadError(getErrorMessage(error, "Failed to load gallery."))
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void start()

    return () => {
      isActive = false
    }
  }, [])

  const galleryItems = useMemo(
    () =>
      gallery?.items.map((item) => ({
        ...item,
        assetUrl: convertFileSrc(item.absolutePath),
      })) ?? [],
    [gallery],
  )

  const galleryCountLabel = useMemo(() => {
    if (!gallery || gallery.items.length === 0) {
      return null
    }

    if (gallery.total > gallery.items.length) {
      return `Showing ${gallery.items.length} of ${gallery.total} archived wallpapers.`
    }

    return `Loaded ${gallery.items.length} archived wallpaper${gallery.items.length === 1 ? "" : "s"}.`
  }, [gallery])

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border/80 bg-card/60 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
          Local wallpaper library
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Gallery</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Browse archived wallpapers from the SQLite library and preview the local files that are
              already stored on disk, including downloads that were moved into a custom directory.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            SQLite archive + local asset backed
          </div>
        </div>
      </header>

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Archive</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            This page reads archived downloads from the Rust gallery command and renders the local
            image files through the Tauri asset protocol using the path metadata stored per archive
            record.
          </p>
        </div>

        {loadError ? (
          <div
            className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {loadError}
          </div>
        ) : null}

        {isLoading && !gallery ? (
          <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            Loading archived wallpapers...
          </div>
        ) : null}

        {!loadError && galleryCountLabel ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {galleryCountLabel}
          </div>
        ) : null}

        {!loadError && !isLoading && galleryItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
            No archived wallpapers yet. Download one from Search to build the local gallery.
          </div>
        ) : null}

        {!loadError && galleryItems.length > 0 ? <GalleryGrid items={galleryItems} /> : null}
      </section>
    </section>
  )
}
