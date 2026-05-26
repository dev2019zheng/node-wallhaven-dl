import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { downloadWallpaper as downloadWallpaperInService } from "@/application/downloads/downloads-service"
import { searchWallpapers as searchWallpapersInService } from "@/application/search/search-service"
import type {
  SearchWallpaper,
  SearchWallpapersResponse,
} from "@/application/search/search.types"
import { Button } from "@/components/ui/button"
import {
  VALID_TOPLIST_RANGES,
  type WallhavenCategoryFilter,
  type WallhavenPurityFilter,
  type WallhavenQueryFilters,
  type WallhavenToplistRange,
} from "@/domain/wallhaven/models"

import { SearchResultGrid } from "./components/SearchResultGrid"

const searchSchema = z.object({
  category: z.enum(["all", "general", "anime", "people", "ga", "gp"]),
  purityPreset: z.enum(["sfw", "sketchy", "nsfw", "ws", "wn", "sn", "all"]),
  sorting: z.enum(["date_added", "toplist"]),
  topRange: z.enum(VALID_TOPLIST_RANGES),
  q: z.string().max(200, "Query is unexpectedly long."),
  page: z.number().int().min(1, "Page must be at least 1."),
})

type SearchFormValues = z.infer<typeof searchSchema>

type DownloadFeedback = {
  tone: "success" | "error"
  message: string
}

const categoryOptions: Array<{ value: WallhavenCategoryFilter; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "general", label: "General only" },
  { value: "anime", label: "Anime only" },
  { value: "people", label: "People only" },
  { value: "ga", label: "General + Anime" },
  { value: "gp", label: "General + People" },
]

const purityOptions = [
  { value: "sfw", label: "SFW" },
  { value: "sketchy", label: "Sketchy" },
  { value: "nsfw", label: "NSFW" },
  { value: "ws", label: "SFW + Sketchy" },
  { value: "wn", label: "SFW + NSFW" },
  { value: "sn", label: "Sketchy + NSFW" },
  { value: "all", label: "All purity levels" },
] as const

const sortingOptions = [
  { value: "date_added", label: "Date added" },
  { value: "toplist", label: "Toplist" },
] as const

const toplistOptions: Array<{ value: WallhavenToplistRange; label: string }> = [
  { value: "1d", label: "Past day" },
  { value: "3d", label: "Past 3 days" },
  { value: "1w", label: "Past week" },
  { value: "1M", label: "Past month" },
  { value: "3M", label: "Past 3 months" },
  { value: "6M", label: "Past 6 months" },
  { value: "1y", label: "Past year" },
]

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function buildPurityFilter(purityPreset: SearchFormValues["purityPreset"]): WallhavenPurityFilter {
  switch (purityPreset) {
    case "sfw":
      return { sfw: true, sketchy: false, nsfw: false }
    case "sketchy":
      return { sfw: false, sketchy: true, nsfw: false }
    case "nsfw":
      return { sfw: false, sketchy: false, nsfw: true }
    case "ws":
      return { sfw: true, sketchy: true, nsfw: false }
    case "wn":
      return { sfw: true, sketchy: false, nsfw: true }
    case "sn":
      return { sfw: false, sketchy: true, nsfw: true }
    case "all":
      return { sfw: true, sketchy: true, nsfw: true }
  }
}

function buildSearchFilters(values: SearchFormValues): WallhavenQueryFilters {
  const baseFilters = {
    categories: values.category,
    purity: buildPurityFilter(values.purityPreset),
    q: values.q.trim(),
    page: values.page,
  }

  if (values.sorting === "toplist") {
    return {
      ...baseFilters,
      sorting: "toplist",
      topRange: values.topRange,
    }
  }

  return {
    ...baseFilters,
    sorting: "date_added",
  }
}

function getFallbackFileExtension(fileType: string): string {
  switch (fileType) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return "img"
  }
}

function buildDownloadFileName(wallpaper: SearchWallpaper): string {
  try {
    const pathSegments = new URL(wallpaper.path).pathname
      .split("/")
      .filter(Boolean)
    const fileName = pathSegments[pathSegments.length - 1]?.trim()

    if (fileName) {
      return fileName
    }
  } catch {
    // Fall back to a deterministic name below when the upstream URL is malformed.
  }

  return `wallhaven-${wallpaper.id}.${getFallbackFileExtension(wallpaper.fileType)}`
}

export function SearchPage() {
  const { formState, handleSubmit, register, watch } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      category: "all",
      purityPreset: "sfw",
      sorting: "date_added",
      topRange: "1M",
      q: "",
      page: 1,
    },
  })
  const [result, setResult] = useState<SearchWallpapersResponse | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null)
  const [downloadingWallpaperIds, setDownloadingWallpaperIds] = useState<string[]>([])
  const isActiveRef = useRef(true)

  useEffect(() => {
    return () => {
      isActiveRef.current = false
    }
  }, [])

  const sorting = watch("sorting")
  const topRangeVisible = sorting === "toplist"
  const downloadingWallpaperIdSet = useMemo(
    () => new Set(downloadingWallpaperIds),
    [downloadingWallpaperIds],
  )
  const resultCountLabel = useMemo(() => {
    if (!result || result.data.length === 0) {
      return null
    }

    const count = result.data.length
    return `Loaded ${count} wallpaper${count === 1 ? "" : "s"} from Wallhaven.`
  }, [result])

  const onSubmit = handleSubmit(async (values) => {
    setSearchError(null)
    setResult(null)
    setDownloadFeedback(null)

    try {
      const nextResult = await searchWallpapersInService(buildSearchFilters(values))
      setResult(nextResult)
    } catch (error) {
      setSearchError(getErrorMessage(error, "Search failed."))
    }
  })

  const onDownload = async (wallpaper: SearchWallpaper) => {
    const fileName = buildDownloadFileName(wallpaper)

    setDownloadingWallpaperIds((currentIds) =>
      currentIds.includes(wallpaper.id) ? currentIds : [...currentIds, wallpaper.id],
    )
    setDownloadFeedback({
      tone: "success",
      message: `${fileName} download started. Open Downloads to monitor live progress.`,
    })

    try {
      await downloadWallpaperInService({
        wallpaperId: wallpaper.id,
        imageUrl: wallpaper.path,
        fileName,
      })

      if (!isActiveRef.current) {
        return
      }

      setDownloadFeedback({
        tone: "success",
        message: `${fileName} finished downloading. Open Downloads to review task history.`,
      })
    } catch (error) {
      if (!isActiveRef.current) {
        return
      }

      setDownloadFeedback({
        tone: "error",
        message: getErrorMessage(error, "Download failed."),
      })
    } finally {
      if (isActiveRef.current) {
        setDownloadingWallpaperIds((currentIds) =>
          currentIds.filter((currentId) => currentId !== wallpaper.id),
        )
      }
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border/80 bg-card/60 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
          Wallpaper discovery
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Search</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Query Wallhaven from the desktop shell with typed filters, predictable request
              shapes, and visible result states.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Search command backed
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form className="space-y-5 rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm" onSubmit={onSubmit}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Start with the legacy Wallhaven filters, then refine by query and page.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Category</span>
              <select className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" {...register("category")}>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Purity</span>
              <select className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" {...register("purityPreset")}>
                {purityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Sorting</span>
              <select className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" {...register("sorting")}>
                {sortingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Page</span>
              <input className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" min={1} step={1} type="number" {...register("page", { valueAsNumber: true })} />
            </label>
          </div>

          {topRangeVisible ? (
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span>Toplist range</span>
              <select className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" {...register("topRange")}>
                {toplistOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Query</span>
            <input className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" placeholder="Optional keyword search" {...register("q")} />
          </label>

          {formState.errors.page ? (
            <p className="text-sm text-destructive" role="alert">
              {formState.errors.page.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button disabled={formState.isSubmitting} type="submit">
              {formState.isSubmitting ? "Searching..." : "Search wallpapers"}
            </Button>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {formState.isSubmitting ? "Submitting search request..." : ""}
            </p>
          </div>
        </form>

        <section className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Results</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              This panel now reflects real search responses. Use Download on any result to send the
              wallpaper into the shared downloads queue.
            </p>
          </div>

          {searchError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {searchError}
            </div>
          ) : null}

          {downloadFeedback ? (
            <div
              className={
                downloadFeedback.tone === "error"
                  ? "rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  : "rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              }
              role={downloadFeedback.tone === "error" ? "alert" : "status"}
            >
              {downloadFeedback.message}
            </div>
          ) : null}

          {!searchError && resultCountLabel ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {resultCountLabel}
            </div>
          ) : null}

          {!searchError && result && result.data.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
              No wallpapers matched the current filters.
            </div>
          ) : null}

          {!searchError && result && result.data.length > 0 ? (
            <SearchResultGrid
              downloadingWallpaperIds={downloadingWallpaperIdSet}
              onDownload={(wallpaper) => {
                void onDownload(wallpaper)
              }}
              wallpapers={result.data}
            />
          ) : null}

          {!searchError && !result ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
              Submit the form to load results from the Rust search command.
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
