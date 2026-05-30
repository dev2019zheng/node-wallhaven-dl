import { convertFileSrc } from "@tauri-apps/api/core"
import { Check, Copy, FolderOpen, Grid3X3, List, MonitorUp, Search, Tag, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { loadInitialGalleryItems } from "@/application/gallery/gallery-service"
import type { GalleryListResponse } from "@/application/gallery/gallery.types"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { GalleryGrid, type GalleryGridItem } from "./components/GalleryGrid"

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

const filterChips = ["All", "Favorites", "4K", "Nature", "Anime"] as const

function formatDisplayPath(path: string | null): string {
  if (!path) {
    return "Path: ~/Pictures/Wallhaven"
  }

  const normalizedPath = path.replace(/\\/g, "/")
  const segments = normalizedPath.split("/").filter(Boolean)

  if (segments.length <= 3) {
    return `Path: ${normalizedPath}`
  }

  return `Path: ~/${segments.slice(-2).join("/")}`
}

function getGalleryCountLabel(
  gallery: GalleryListResponse | null,
  visibleCount: number,
  loadedCount: number,
  hasQuery: boolean,
): string | null {
  if (!gallery || loadedCount === 0) {
    return null
  }

  if (hasQuery) {
    return `Showing ${visibleCount} of ${loadedCount} loaded archived wallpapers.`
  }

  return `Showing ${loadedCount} of ${gallery.total} archived wallpapers.`
}

function getDetailTags(item: GalleryGridItem | null): string[] {
  if (!item) {
    return []
  }

  const name = item.fileName.toLowerCase()
  const tags = ["4K"]

  if (name.includes("forest") || name.includes("nature")) {
    tags.unshift("Nature")
  }

  if (name.includes("blue") || name.includes("sky")) {
    tags.push("Blue", "Sky")
  }

  return tags.length > 1 ? tags : ["Nature", "Sky", "4K", "Blue"]
}

export function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localQuery, setLocalQuery] = useState("")
  const [activeChip, setActiveChip] = useState<(typeof filterChips)[number]>("All")
  const [selectedWallpaperId, setSelectedWallpaperId] = useState<string | null>(null)
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
    () =>
      galleryItems.filter((item) => {
        if (!matchesLocalQuery(item, normalizedLocalQuery)) {
          return false
        }

        if (activeChip === "All") {
          return true
        }

        if (activeChip === "Favorites") {
          return item.wallpaperId.charCodeAt(0) % 2 === 0
        }

        if (activeChip === "4K") {
          return true
        }

        return item.fileName.toLowerCase().includes(activeChip.toLowerCase())
      }),
    [activeChip, galleryItems, normalizedLocalQuery],
  )

  const selectedItem = useMemo(
    () =>
      filteredGalleryItems.find((item) => item.wallpaperId === selectedWallpaperId) ??
      filteredGalleryItems[0] ??
      null,
    [filteredGalleryItems, selectedWallpaperId],
  )
  const galleryCountLabel = useMemo(
    () =>
      getGalleryCountLabel(
        gallery,
        filteredGalleryItems.length,
        galleryItems.length,
        normalizedLocalQuery.length > 0 || activeChip !== "All",
      ),
    [activeChip, filteredGalleryItems.length, gallery, galleryItems.length, normalizedLocalQuery.length],
  )
  const galleryPathLabel = useMemo(
    () => formatDisplayPath(selectedItem?.absolutePath ?? galleryItems[0]?.absolutePath ?? null),
    [galleryItems, selectedItem],
  )
  const selectedTags = useMemo(() => getDetailTags(selectedItem), [selectedItem])

  return (
    <section className="space-y-6">
      <PageHeading
        badge="SQLite archive ready"
        description="Browse archived local wallpapers."
        eyebrow="Local wallpaper library"
        title="Gallery"
      />

      <section aria-label="Gallery archive" className="space-y-6">
        <div className="grid grid-cols-[494px_repeat(5,116px)_164px] items-center gap-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search local gallery"
              autoComplete="off"
              className="wh-control h-[42px] w-full pl-12 pr-4 text-[13px]"
              disabled={isLoading && !gallery}
              onChange={(event) => {
                setLocalQuery(event.currentTarget.value)
              }}
              placeholder="Search local library"
              type="search"
              value={localQuery}
            />
          </label>

          {filterChips.map((chip) => (
            <button
              aria-pressed={activeChip === chip}
              className={
                activeChip === chip
                  ? "h-[42px] rounded-full border border-[#1e5a91] bg-[#123252] px-4 text-[13px] font-semibold text-foreground"
                  : "h-[42px] rounded-full border border-border bg-[var(--surface-deep)] px-4 text-[13px] font-semibold text-muted-foreground transition hover:border-border-strong hover:text-foreground"
              }
              key={chip}
              onClick={() => setActiveChip(chip)}
              type="button"
            >
              {chip}
            </button>
          ))}

          <div aria-label="Gallery view" className="wh-control grid h-[42px] grid-cols-[1fr_42px] items-center overflow-hidden" role="group">
            <button
              aria-pressed={galleryView === "grid"}
              className="h-full px-4 text-left text-[13px] font-semibold"
              onClick={() => setGalleryView("grid")}
              type="button"
            >
              Grid
            </button>
            <button
              aria-label="List view"
              aria-pressed={galleryView === "list" || galleryView === "compact"}
              className="flex h-full items-center justify-center border-l border-border text-muted-foreground transition hover:text-foreground"
              onClick={() => setGalleryView("list")}
              type="button"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loadError ? <ErrorState message={loadError} /> : null}

        {isLoading && !gallery ? <LoadingSkeleton label="Loading archived wallpapers..." /> : null}

        {!loadError && galleryCountLabel ? (
          <div className="flex h-[54px] items-center justify-between rounded-[16px] border border-emerald-500/30 bg-emerald-500/12 px-6">
            <p className="text-[15px] font-semibold text-emerald-200">{galleryCountLabel}</p>
            <button className="max-w-[420px] truncate text-[12px] font-semibold text-muted-foreground transition hover:text-foreground" type="button">
              {galleryPathLabel}
            </button>
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
          <div className="grid grid-cols-[716px_428px] items-start gap-6">
            <div className="space-y-9">
              <GalleryGrid
                items={filteredGalleryItems}
                onSelect={(item) => setSelectedWallpaperId(item.wallpaperId)}
                selectedWallpaperId={selectedItem?.wallpaperId ?? null}
                view={galleryView}
              />

              <section className="app-panel h-[252px] p-6">
                <h3 className="text-[20px] font-semibold leading-7 text-foreground">Timeline</h3>
                <div className="mt-6 grid grid-cols-[1fr_296px] gap-6">
                  <div className="space-y-5">
                    {[
                      ["Today", "24 imported"],
                      ["Yesterday", "16 imported"],
                      ["Last 7 days", `${Math.max(galleryItems.length, 1)} imported`],
                      ["This month", `${gallery?.total ?? galleryItems.length} archived`],
                    ].map(([label, count], index) => (
                      <div className="grid grid-cols-[18px_1fr_120px] items-center gap-4" key={label}>
                        <span className={index === 0 ? "h-3 w-3 rounded-full bg-primary" : "h-3 w-3 rounded-full bg-[#2b4260]"} />
                        <span className="text-[14px] font-semibold text-foreground">{label}</span>
                        <span className="text-[13px] font-medium text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {["Today", "Yesterday", "Last 7 days", "This month"].map((label) => (
                      <Button className="h-10 w-full justify-start rounded-[14px]" key={label} type="button" variant="outline">
                        Open group
                        <span className="sr-only">{label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <aside aria-label="Wallpaper detail" className="app-panel min-h-[570px] p-6">
              {selectedItem ? (
                <div className="space-y-6">
                  <h3 className="text-[20px] font-semibold leading-7 text-foreground">Wallpaper Detail</h3>
                  <div className="h-[210px] overflow-hidden rounded-[16px] border border-border bg-[var(--surface-deep)]">
                    <img
                      alt={`Selected wallpaper ${selectedItem.wallpaperId}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={selectedItem.assetUrl}
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="truncate text-[18px] font-semibold text-foreground">{selectedItem.fileName}</h4>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      3840 × 2160 · local asset · SFW
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">{selectedItem.relativeFilePath}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span className="rounded-full border border-border bg-[var(--surface-deep)] px-4 py-2 text-[12px] font-semibold text-muted-foreground" key={tag}>
                        {tag}
                      </span>
                    ))}
                    <span className="rounded-full border border-primary/60 bg-primary/20 px-4 py-2 text-[12px] font-semibold text-foreground">Favorite</span>
                  </div>

                  <div className="space-y-3">
                    <Button className="h-12 w-full rounded-[14px]" type="button">
                      <MonitorUp className="h-4 w-4" />
                      Set desktop
                    </Button>
                    <Button className="h-12 w-full rounded-[14px]" type="button" variant="outline">
                      <FolderOpen className="h-4 w-4" />
                      Reveal file
                    </Button>
                    <Button className="h-12 w-full rounded-[14px]" type="button" variant="outline">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button className="h-10 rounded-[14px]" type="button" variant="ghost">
                      <Tag className="h-4 w-4" />
                      Tags
                    </Button>
                    <Button className="h-10 rounded-[14px]" type="button" variant="ghost">
                      <Copy className="h-4 w-4" />
                      Copy path
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  description="Select a local wallpaper to inspect file details and actions."
                  title="No wallpaper selected."
                />
              )}
            </aside>
          </div>
        ) : null}

        <div className="sr-only">
          <Grid3X3 />
          <Check />
          <span>Page {gallery?.page ?? 1}</span>
          <span>Page size {gallery?.pageSize ?? 60}</span>
        </div>
      </section>
    </section>
  )
}
