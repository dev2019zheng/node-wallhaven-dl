import { convertFileSrc } from "@tauri-apps/api/core"
import { Check, Copy, Download, ExternalLink, FolderOpen, Grid3X3, Heart, List, Search, Tag, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { downloadWallpaper as downloadWallpaperInService } from "@/application/downloads/downloads-service"
import {
  deleteGalleryItem as deleteGalleryItemInService,
  loadInitialGalleryItems,
  setGalleryFavorite as setGalleryFavoriteInService,
  updateGalleryTags as updateGalleryTagsInService,
} from "@/application/gallery/gallery-service"
import type { GalleryItem, GalleryListResponse } from "@/application/gallery/gallery.types"
import { loadSettingsPreferences } from "@/application/settings/settings-service"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import {
  type GalleryCollectionShortcut,
  useUiShellStore,
} from "@/features/shell/ui-shell-store"
import { writeClipboardText } from "@/infrastructure/browser/clipboard"
import {
  DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE,
  isNativeShellAvailable,
  revealPath,
} from "@/infrastructure/tauri/native-shell"

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

const filterChips = ["All", "Favorites", "SFW", "Sketchy", "NSFW", "Anime"] as const
type FilterChip = (typeof filterChips)[number]

const collectionChipByShortcut: Partial<Record<GalleryCollectionShortcut, FilterChip>> = {
  Favorites: "Favorites",
  Anime: "Anime",
}

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

  return Array.from(
    new Set([
      item.purity?.toUpperCase() ?? "SFW",
      ...(item.category ? [item.category] : []),
      ...item.tags,
    ]),
  )
}

function parseTagDraft(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

  return Array.from(new Set(tags))
}

function areTagsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index])
}

function getFileExtension(fileName: string): string | null {
  const separatorIndex = fileName.lastIndexOf(".")

  if (separatorIndex < 0 || separatorIndex === fileName.length - 1) {
    return null
  }

  const extension = fileName.slice(separatorIndex + 1).trim().toLowerCase()

  return extension ? extension : null
}

function getGalleryDownloadImageUrl(item: GalleryGridItem): string {
  try {
    const sourceUrl = new URL(item.sourceUrl)
    const normalizedPath = sourceUrl.pathname.replace(/\/$/, "")
    const isWallhavenPageUrl =
      (sourceUrl.hostname === "wallhaven.cc" || sourceUrl.hostname === "www.wallhaven.cc") &&
      normalizedPath === `/w/${item.wallpaperId}`
    const extension = getFileExtension(item.fileName)

    if (isWallhavenPageUrl && item.wallpaperId.length >= 2 && extension) {
      return `https://w.wallhaven.cc/full/${item.wallpaperId.slice(0, 2)}/wallhaven-${item.wallpaperId}.${extension}`
    }
  } catch {
    // Keep the archived source URL when it is not parseable.
  }

  return item.sourceUrl
}

function matchesTermBucket(item: GalleryGridItem, terms: string[]): boolean {
  const searchableText = [
    item.fileName,
    item.relativeFilePath,
    item.sourceUrl,
    item.category ?? "",
    item.purity ?? "",
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase()

  return terms.some((term) => searchableText.includes(term))
}

function matchesCollectionShortcut(item: GalleryGridItem, shortcut: GalleryCollectionShortcut | null): boolean {
  if (!shortcut) {
    return true
  }

  switch (shortcut) {
    case "Favorites":
      return item.isFavorite
    case "Anime":
      return item.category === "anime" || matchesTermBucket(item, ["anime"])
    case "Nature":
      return matchesTermBucket(item, ["nature", "forest", "mountain", "landscape", "river", "sky"])
    case "Space":
      return matchesTermBucket(item, ["space", "star", "galaxy", "nebula", "planet"])
    case "4K Ultra":
      return matchesTermBucket(item, ["4k", "uhd", "3840", "2160"])
  }
}

type ImportGroupLabel = "Today" | "Yesterday" | "Last 7 days" | "This month"

const importGroupLabels: ImportGroupLabel[] = ["Today", "Yesterday", "Last 7 days", "This month"]

function parseCreatedAt(createdAt: string): Date | null {
  const createdDate = new Date(createdAt.replace(" ", "T"))

  if (Number.isNaN(createdDate.getTime())) {
    return null
  }

  return createdDate
}

function isInImportGroup(createdAt: string, group: string | null, now = new Date()): boolean {
  if (!group) {
    return true
  }

  const createdDate = parseCreatedAt(createdAt)
  if (!createdDate) {
    return group === "This month"
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfSevenDays = new Date(startOfToday)
  startOfSevenDays.setDate(startOfSevenDays.getDate() - 6)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  switch (group) {
    case "Today":
      return createdDate >= startOfToday && createdDate < startOfTomorrow
    case "Yesterday":
      return createdDate >= startOfYesterday && createdDate < startOfToday
    case "Last 7 days":
      return createdDate >= startOfSevenDays && createdDate < startOfTomorrow
    case "This month":
      return createdDate >= startOfMonth && createdDate < startOfTomorrow
    default:
      return true
  }
}

export function GalleryPage() {
  const [gallery, setGallery] = useState<GalleryListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localQuery, setLocalQuery] = useState("")
  const [activeChip, setActiveChip] = useState<(typeof filterChips)[number]>("SFW")
  const [activeCollectionShortcut, setActiveCollectionShortcut] = useState<GalleryCollectionShortcut | null>(null)
  const [activeImportGroup, setActiveImportGroup] = useState<ImportGroupLabel | null>(null)
  const [selectedWallpaperId, setSelectedWallpaperId] = useState<string | null>(null)
  const [focusedTagWallpaperId, setFocusedTagWallpaperId] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState("")
  const [tagDraftWallpaperId, setTagDraftWallpaperId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true)
  const tagInputRef = useRef<HTMLInputElement | null>(null)
  const galleryView = useUiShellStore((state) => state.galleryView)
  const galleryCollectionRequest = useUiShellStore((state) => state.galleryCollectionRequest)
  const setActiveGalleryCollectionShortcut = useUiShellStore((state) => state.setActiveGalleryCollectionShortcut)
  const setGalleryView = useUiShellStore((state) => state.setGalleryView)
  const enqueueToast = useUiShellStore((state) => state.enqueueToast)
  const setConfirm = useUiShellStore((state) => state.setConfirm)
  const canUseNativeShell = isNativeShellAvailable()

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
    void loadSettingsPreferences()
      .then((preferences) => {
        if (isActive) {
          setConfirmBeforeDelete(preferences.confirmBeforeDelete)
        }
      })
      .catch(() => {
        // Keep the safe default when preferences fail to load.
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!galleryCollectionRequest) {
      return
    }

    const chip = collectionChipByShortcut[galleryCollectionRequest.label]
    setActiveChip(chip ?? "All")
    setActiveCollectionShortcut(chip ? null : galleryCollectionRequest.label)
    setActiveImportGroup(null)
    setLocalQuery("")
    setSelectedWallpaperId(null)
  }, [galleryCollectionRequest])

  const activeSidebarCollectionShortcut = useMemo<GalleryCollectionShortcut | null>(() => {
    if (activeChip === "Favorites" || activeChip === "Anime") {
      return activeChip
    }

    return activeCollectionShortcut
  }, [activeChip, activeCollectionShortcut])

  const galleryItems = useMemo(
    () =>
      gallery?.items.map((item) => ({
        ...item,
        assetUrl: convertFileSrc(item.absolutePath),
      })) ?? [],
    [gallery],
  )

  useEffect(() => {
    setActiveGalleryCollectionShortcut(activeSidebarCollectionShortcut)
  }, [activeSidebarCollectionShortcut, setActiveGalleryCollectionShortcut])
  const normalizedLocalQuery = useMemo(() => localQuery.trim().toLowerCase(), [localQuery])
  const filteredGalleryItems = useMemo(
    () =>
      galleryItems.filter((item) => {
        if (!matchesLocalQuery(item, normalizedLocalQuery)) {
          return false
        }

        if (activeChip === "Favorites") {
          return item.isFavorite
        }

        if (activeChip === "SFW" || activeChip === "Sketchy" || activeChip === "NSFW") {
          return item.purity === activeChip.toLowerCase()
        }

        if (activeChip === "Anime") {
          return item.category === "anime" || item.fileName.toLowerCase().includes("anime")
        }

        if (!matchesCollectionShortcut(item, activeCollectionShortcut)) {
          return false
        }

        if (!isInImportGroup(item.createdAt, activeImportGroup)) {
          return false
        }

        return true
      }),
    [activeChip, activeCollectionShortcut, activeImportGroup, galleryItems, normalizedLocalQuery],
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
        normalizedLocalQuery.length > 0 ||
          activeChip !== "All" ||
          activeCollectionShortcut !== null ||
          activeImportGroup !== null,
      ),
    [
      activeChip,
      activeCollectionShortcut,
      activeImportGroup,
      filteredGalleryItems.length,
      gallery,
      galleryItems.length,
      normalizedLocalQuery.length,
    ],
  )
  const galleryPathLabel = useMemo(
    () => formatDisplayPath(selectedItem?.absolutePath ?? galleryItems[0]?.absolutePath ?? null),
    [galleryItems, selectedItem],
  )
  const parsedTagDraft = useMemo(() => parseTagDraft(tagDraft), [tagDraft])
  const hasTagDraftChanges = useMemo(
    () =>
      Boolean(
        selectedItem &&
          tagDraftWallpaperId === selectedItem.wallpaperId &&
          !areTagsEqual(parsedTagDraft, selectedItem.tags),
      ),
    [parsedTagDraft, selectedItem, tagDraftWallpaperId],
  )
  const selectedTags = useMemo(() => getDetailTags(selectedItem), [selectedItem])
  const timelineGroups = useMemo(() => {
    return importGroupLabels.map((label) => ({
      label,
      count: galleryItems.filter((item) => isInImportGroup(item.createdAt, label)).length,
    }))
  }, [galleryItems])

  useEffect(() => {
    setTagDraft(selectedItem?.tags.join(", ") ?? "")
    setTagDraftWallpaperId(selectedItem?.wallpaperId ?? null)
  }, [selectedItem?.wallpaperId, selectedItem?.tags])

  useEffect(() => {
    if (!focusedTagWallpaperId || selectedItem?.wallpaperId !== focusedTagWallpaperId) {
      return
    }

    tagInputRef.current?.focus()
    setFocusedTagWallpaperId(null)
  }, [focusedTagWallpaperId, selectedItem?.wallpaperId])

  const updateGalleryItem = (updatedItem: GalleryItem) => {
    setGallery((currentGallery) => {
      if (!currentGallery) {
        return currentGallery
      }

      return {
        ...currentGallery,
        items: currentGallery.items.map((item) =>
          item.wallpaperId === updatedItem.wallpaperId ? updatedItem : item,
        ),
      }
    })
  }

  const removeGalleryItem = (wallpaperId: string) => {
    setGallery((currentGallery) => {
      if (!currentGallery) {
        return currentGallery
      }

      const nextItems = currentGallery.items.filter((item) => item.wallpaperId !== wallpaperId)
      return {
        ...currentGallery,
        items: nextItems,
        total: Math.max(0, currentGallery.total - (nextItems.length === currentGallery.items.length ? 0 : 1)),
      }
    })
    setSelectedWallpaperId((currentWallpaperId) => (currentWallpaperId === wallpaperId ? null : currentWallpaperId))
  }

  const showToast = (title: string, description: string, tone: "success" | "error" | "info" = "success") => {
    enqueueToast({
      id: `gallery-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description,
      tone,
    })
  }

  const handleToggleFavorite = async (item: GalleryGridItem) => {
    const isFavorite = !item.isFavorite
    setPendingAction(`favorite:${item.wallpaperId}`)

    try {
      const updatedItem = await setGalleryFavoriteInService({
        wallpaperId: item.wallpaperId,
        isFavorite,
      })
      updateGalleryItem(updatedItem)
      showToast(
        isFavorite ? "Added to favorites" : "Removed from favorites",
        item.fileName,
      )
    } catch (error) {
      showToast("Favorite failed", getErrorMessage(error, "Unable to update favorite."), "error")
    } finally {
      setPendingAction(null)
    }
  }

  const handleSaveTags = async (item: GalleryGridItem) => {
    const nextTags = parseTagDraft(tagDraft)
    if (areTagsEqual(nextTags, item.tags)) {
      return
    }

    setPendingAction(`tags:${item.wallpaperId}`)

    try {
      const updatedItem = await updateGalleryTagsInService({
        wallpaperId: item.wallpaperId,
        tags: nextTags,
      })
      updateGalleryItem(updatedItem)
      showToast("Tags saved", updatedItem.tags.length > 0 ? updatedItem.tags.join(", ") : "No custom tags")
    } catch (error) {
      showToast("Tag update failed", getErrorMessage(error, "Unable to update tags."), "error")
    } finally {
      setPendingAction(null)
    }
  }

  const handleCopyPath = async (item: GalleryGridItem) => {
    try {
      await writeClipboardText(item.absolutePath)
      showToast("Path copied", item.absolutePath)
    } catch (error) {
      showToast("Copy failed", getErrorMessage(error, "Clipboard is unavailable."), "error")
    }
  }

  const handleDownloadAgain = async (item: GalleryGridItem) => {
    setPendingAction(`download:${item.wallpaperId}`)

    try {
      await downloadWallpaperInService({
        wallpaperId: item.wallpaperId,
        imageUrl: getGalleryDownloadImageUrl(item),
        fileName: item.fileName,
        purity: item.purity ?? undefined,
        category: item.category ?? undefined,
      })
      showToast("Download queued", item.fileName)
    } catch (error) {
      showToast("Download failed", getErrorMessage(error, "Unable to queue download."), "error")
    } finally {
      setPendingAction(null)
    }
  }

  const handleRevealItem = async (item: GalleryGridItem) => {
    if (!canUseNativeShell) {
      showToast("Desktop runtime unavailable", DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE, "info")
      return
    }

    setPendingAction(`reveal:${item.wallpaperId}`)

    try {
      await revealPath(item.absolutePath)
    } catch (error) {
      showToast("Reveal failed", getErrorMessage(error, "Unable to reveal the local file."), "error")
    } finally {
      setPendingAction(null)
    }
  }

  const deleteItem = async (item: GalleryGridItem) => {
    setPendingAction(`delete:${item.wallpaperId}`)

    try {
      await deleteGalleryItemInService({ wallpaperId: item.wallpaperId })
      removeGalleryItem(item.wallpaperId)
      showToast("Wallpaper deleted", item.fileName)
    } catch (error) {
      showToast("Delete failed", getErrorMessage(error, "Unable to delete the local wallpaper."), "error")
    } finally {
      setPendingAction(null)
    }
  }

  const handleDeleteItem = (item: GalleryGridItem) => {
    if (!confirmBeforeDelete) {
      void deleteItem(item)
      return
    }

    setConfirm({
      title: "Delete wallpaper?",
      description: `This removes ${item.fileName} from disk and the local gallery archive.`,
      confirmLabel: "Delete wallpaper",
      onConfirm: () => {
        void deleteItem(item)
      },
    })
  }
  const headingBadge = isLoading && !gallery
    ? { label: "Loading archive", tone: "info" as const }
    : loadError
      ? { label: "Archive unavailable", tone: "error" as const }
      : galleryItems.length > 0
        ? { label: "Archive loaded", tone: "success" as const }
        : { label: "Archive empty", tone: "info" as const }

  return (
    <section className="space-y-6">
      <PageHeading
        badge={headingBadge.label}
        badgeTone={headingBadge.tone}
        description="Browse archived local wallpapers."
        eyebrow="Local wallpaper library"
        title="Gallery"
      />

      <section aria-label="Gallery archive" className="space-y-6">
        <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(240px,1fr)_repeat(2,minmax(88px,1fr))] xl:grid-cols-[minmax(360px,1fr)_repeat(5,116px)_164px] xl:gap-4">
          <label className="relative block md:col-span-3 xl:col-span-1">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search local gallery"
              autoComplete="off"
              className="wh-control h-[42px] w-full pl-12 pr-4 text-[13px]"
              disabled={isLoading && !gallery}
              onChange={(event) => {
                setLocalQuery(event.currentTarget.value)
                setActiveCollectionShortcut(null)
                setActiveImportGroup(null)
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
                  ? "wh-selected-surface h-[42px] rounded-full border px-4 text-[13px] font-semibold text-foreground"
                  : "h-[42px] rounded-full border border-border bg-[var(--surface-deep)] px-4 text-[13px] font-semibold text-muted-foreground transition hover:border-border-strong hover:text-foreground"
              }
              key={chip}
              onClick={() => {
                setActiveChip(chip)
                setActiveCollectionShortcut(null)
                setActiveImportGroup(null)
              }}
              type="button"
            >
              {chip}
            </button>
          ))}

          <div aria-label="Gallery view" className="wh-control grid h-[42px] grid-cols-2 items-center overflow-hidden p-0" role="group">
            <button
              aria-pressed={galleryView === "grid"}
              className={
                galleryView === "grid"
                  ? "wh-selected-surface flex h-full items-center justify-center gap-2 px-3 text-[13px] font-semibold text-foreground"
                  : "flex h-full items-center justify-center gap-2 px-3 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground"
              }
              onClick={() => setGalleryView("grid")}
              type="button"
            >
              <Grid3X3 className="h-4 w-4" />
              Grid
            </button>
            <button
              aria-label="List view"
              aria-pressed={galleryView === "list"}
              className={
                galleryView === "list"
                  ? "wh-selected-surface flex h-full items-center justify-center border-l border-border text-foreground"
                  : "flex h-full items-center justify-center border-l border-border text-muted-foreground transition hover:text-foreground"
              }
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
          <div className="wh-soft-success flex h-[54px] items-center justify-between rounded-[16px] px-6">
            <p className="text-[15px] font-semibold">{galleryCountLabel}</p>
            <button
              className="max-w-[420px] truncate text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground"
              disabled={!selectedItem || pendingAction === `reveal:${selectedItem.wallpaperId}` || !canUseNativeShell}
              onClick={() => {
                if (selectedItem) {
                  void handleRevealItem(selectedItem)
                }
              }}
              type="button"
            >
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
          <div className="grid grid-cols-1 items-start gap-6 min-[1280px]:grid-cols-[minmax(0,1fr)_360px] min-[1500px]:grid-cols-[minmax(0,1fr)_428px]">
            <div className="space-y-9">
              <GalleryGrid
                items={filteredGalleryItems}
                onTag={(item) => {
                  setSelectedWallpaperId(item.wallpaperId)
                  setTagDraft(item.tags.join(", "))
                  setTagDraftWallpaperId(item.wallpaperId)
                  setFocusedTagWallpaperId(item.wallpaperId)
                }}
                onSelect={(item) => setSelectedWallpaperId(item.wallpaperId)}
                onToggleFavorite={(item) => {
                  void handleToggleFavorite(item)
                }}
                selectedWallpaperId={selectedItem?.wallpaperId ?? null}
                view={galleryView}
              />

              <section className="app-panel h-[252px] p-6">
                <h3 className="text-[20px] font-semibold leading-7 text-foreground">Timeline</h3>
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px] min-[1400px]:grid-cols-[1fr_296px]">
                  <div className="space-y-5">
                    {timelineGroups.map(({ label, count }) => (
                      <div className="grid grid-cols-[18px_1fr_120px] items-center gap-4" key={label}>
                        <span className={activeImportGroup === label ? "h-3 w-3 rounded-full bg-primary" : "h-3 w-3 rounded-full bg-[var(--timeline-dot-muted)]"} />
                        <span className="text-[14px] font-semibold text-foreground">{label}</span>
                        <span className="text-[13px] font-medium text-muted-foreground">{count} imported</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {timelineGroups.map(({ label, count }) => {
                      const isActiveTimelineGroup = activeImportGroup === label

                      return (
                        <Button
                          aria-label={`Open group ${label}`}
                          aria-pressed={isActiveTimelineGroup}
                          className={
                            isActiveTimelineGroup
                              ? "wh-selected-surface h-10 w-full justify-start rounded-[14px] text-foreground"
                              : "h-10 w-full justify-start rounded-[14px]"
                          }
                          disabled={count === 0}
                          key={label}
                          onClick={() => {
                            setActiveChip("All")
                            setActiveCollectionShortcut(null)
                            setActiveImportGroup(label)
                            setLocalQuery("")
                            setSelectedWallpaperId(null)
                          }}
                          type="button"
                          variant="outline"
                        >
                          Open {label}
                        </Button>
                      )
                    })}
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
                      Local asset · {(selectedItem.purity ?? "sfw").toUpperCase()} · {selectedItem.category ?? "general"}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">{selectedItem.relativeFilePath}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span className="rounded-full border border-border bg-[var(--surface-deep)] px-4 py-2 text-[12px] font-semibold text-muted-foreground" key={tag}>
                        {tag}
                      </span>
                    ))}
                    {selectedItem.isFavorite ? (
                      <span className="rounded-full border border-primary/60 bg-primary/20 px-4 py-2 text-[12px] font-semibold text-foreground">Favorite</span>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <Button
                      className="h-12 w-full rounded-[14px]"
                      disabled={pendingAction === `download:${selectedItem.wallpaperId}`}
                      onClick={() => {
                        void handleDownloadAgain(selectedItem)
                      }}
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                      {pendingAction === `download:${selectedItem.wallpaperId}` ? "Queueing" : "Download"}
                    </Button>
                    <a
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-2 text-[13px] font-semibold transition-colors hover:border-border-strong hover:bg-[var(--surface-hover)]"
                      href={selectedItem.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open source
                    </a>
                    <Button
                      className="h-12 w-full rounded-[14px]"
                      disabled={pendingAction === `favorite:${selectedItem.wallpaperId}`}
                      onClick={() => {
                        void handleToggleFavorite(selectedItem)
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Heart className={selectedItem.isFavorite ? "h-4 w-4 fill-current text-rose-300" : "h-4 w-4"} />
                      {selectedItem.isFavorite ? "Unfavorite" : "Favorite"}
                    </Button>
                    <Button
                      className="h-12 w-full rounded-[14px]"
                      onClick={() => {
                        void handleCopyPath(selectedItem)
                      }}
                      type="button"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                      Copy path
                    </Button>
                  </div>

                  <div className="rounded-[16px] border border-border bg-[var(--surface-deep)] p-3">
                    <label className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="gallery-tags">
                      Tags
                    </label>
                    <input
                      aria-label="Edit gallery tags"
                      autoComplete="off"
                      className="wh-control mt-3 h-10 w-full px-4 text-[13px]"
                      id="gallery-tags"
                      onChange={(event) => {
                        setTagDraft(event.currentTarget.value)
                        setTagDraftWallpaperId(selectedItem.wallpaperId)
                      }}
                      placeholder="nature, ultrawide, OLED"
                      ref={tagInputRef}
                      value={tagDraft}
                    />
                    <Button
                      className="mt-3 h-10 w-full rounded-[14px]"
                      disabled={pendingAction === `tags:${selectedItem.wallpaperId}` || !hasTagDraftChanges}
                      onClick={() => {
                        void handleSaveTags(selectedItem)
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <Tag className="h-4 w-4" />
                      {pendingAction === `tags:${selectedItem.wallpaperId}` ? "Saving tags" : "Save tags"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-10 rounded-[14px]"
                      disabled={pendingAction === `reveal:${selectedItem.wallpaperId}` || !canUseNativeShell}
                      onClick={() => {
                        void handleRevealItem(selectedItem)
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <FolderOpen className="h-4 w-4" />
                      {pendingAction === `reveal:${selectedItem.wallpaperId}` ? "Revealing" : "Reveal"}
                    </Button>
                    <Button
                      className="h-10 rounded-[14px]"
                      disabled={pendingAction === `delete:${selectedItem.wallpaperId}`}
                      onClick={() => {
                        handleDeleteItem(selectedItem)
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                      {pendingAction === `delete:${selectedItem.wallpaperId}` ? "Deleting" : "Delete"}
                    </Button>
                  </div>
                  {!canUseNativeShell ? (
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      Revealing local files is available in the desktop app.
                    </p>
                  ) : null}
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
