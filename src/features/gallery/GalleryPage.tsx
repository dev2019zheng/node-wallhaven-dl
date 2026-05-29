import { convertFileSrc } from "@tauri-apps/api/core"
import { useEffect, useMemo, useState } from "react"

import { loadInitialGalleryItems } from "@/application/gallery/gallery-service"
import type { GalleryListResponse } from "@/application/gallery/gallery.types"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { PageHeading } from "@/components/page-heading"
import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { GalleryGrid, type GalleryGridItem } from "./components/GalleryGrid"
import { GallerySidebar } from "./components/GallerySidebar"
import { GalleryToolbar } from "./components/GalleryToolbar"

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function matchesLocalQuery(item: GalleryGridItem, query: string): boolean {
  if (!query) {
    return true
  }

  return [
    item.fileName,
    item.wallpaperId,
    item.relativeFilePath,
    item.createdAt,
    item.sourceUrl,
  ].some((value) => value.toLowerCase().includes(query))
}

export function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localQuery, setLocalQuery] = useState("")
  const galleryView = useUiShellStore((state) => state.galleryView)
  const setGalleryView = useUiShellStore((state) => state.setGalleryView)

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
  const normalizedLocalQuery = useMemo(() => localQuery.trim().toLowerCase(), [localQuery])
  const filteredGalleryItems = useMemo(
    () => galleryItems.filter((item) => matchesLocalQuery(item, normalizedLocalQuery)),
    [galleryItems, normalizedLocalQuery],
  )

  const galleryCountLabel = useMemo(() => {
    if (!gallery || gallery.items.length === 0) {
      return null
    }

    if (normalizedLocalQuery) {
      return `Showing ${filteredGalleryItems.length} of ${galleryItems.length} loaded archived wallpaper${galleryItems.length === 1 ? "" : "s"}.`
    }

    if (gallery.total > gallery.items.length) {
      return `Showing ${gallery.items.length} of ${gallery.total} archived wallpapers.`
    }

    return `Loaded ${gallery.items.length} archived wallpaper${gallery.items.length === 1 ? "" : "s"}.`
  }, [filteredGalleryItems.length, gallery, galleryItems.length, normalizedLocalQuery])

  return (
    <section className="space-y-6">
      <PageHeading
        badge="SQLite archive + local asset backed"
        description="Browse archived local wallpapers."
        eyebrow="Local wallpaper library"
        title="Gallery"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] xl:items-start">
        <GallerySidebar
          archivedCount={gallery?.total ?? 0}
          hasActiveSearch={normalizedLocalQuery.length > 0}
          loadedCount={galleryItems.length}
          view={galleryView}
          visibleCount={filteredGalleryItems.length}
        />

        <section
          aria-label="Gallery archive"
          className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Archive workspace</h3>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Search within the loaded archive, toggle density, and open lightbox previews without
                changing the Rust-backed gallery service or local asset pipeline.
              </p>
            </div>
            {gallery ? (
              <div className="rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                Page {gallery.page} · up to {gallery.pageSize} loaded from the archive command
              </div>
            ) : null}
          </div>

          <GalleryToolbar
            disabled={isLoading && !gallery}
            onQueryChange={setLocalQuery}
            onViewChange={setGalleryView}
            query={localQuery}
            totalCount={galleryItems.length}
            view={galleryView}
            visibleCount={filteredGalleryItems.length}
          />

          {loadError ? <ErrorState message={loadError} /> : null}

          {isLoading && !gallery ? <LoadingSkeleton label="Loading archived wallpapers..." /> : null}

          {!loadError && galleryCountLabel ? (
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              {galleryCountLabel}
            </div>
          ) : null}

          {!loadError && !isLoading && galleryItems.length === 0 ? (
            <EmptyState
              description="Download one from Search to build the local gallery."
              title="No archived wallpapers yet."
            />
          ) : null}

          {!loadError && !isLoading && galleryItems.length > 0 && filteredGalleryItems.length === 0 ? (
            <EmptyState title="No archived wallpapers matched the current local search." />
          ) : null}

          {!loadError && filteredGalleryItems.length > 0 ? (
            <GalleryGrid items={filteredGalleryItems} view={galleryView} />
          ) : null}
        </section>
      </div>
    </section>
  )
}
