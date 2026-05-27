import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { downloadWallpaper as downloadWallpaperInService } from "@/application/downloads/downloads-service";
import { searchWallpapers as searchWallpapersInService } from "@/application/search/search-service";
import type {
  SearchWallpaper,
  SearchWallpapersResponse,
} from "@/application/search/search.types";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import {
  VALID_TOPLIST_RANGES,
  type WallhavenCategoryFilter,
  type WallhavenPurityFilter,
  type WallhavenQueryFilters,
  type WallhavenToplistRange,
} from "@/domain/wallhaven/models";

import { SearchResultGrid } from "./components/SearchResultGrid";
import {
  getSearchPageSessionSnapshot,
  saveSearchPageSessionSnapshot,
} from "./search-page-session";

const BULK_DOWNLOAD_CONCURRENCY = 4;

const searchSchema = z.object({
  category: z.enum(["all", "general", "anime", "people", "ga", "gp"]),
  purityPreset: z.enum(["sfw", "sketchy", "nsfw", "ws", "wn", "sn", "all"]),
  sorting: z.enum(["date_added", "toplist"]),
  topRange: z.enum(VALID_TOPLIST_RANGES),
  q: z.string().max(200, "Query is unexpectedly long."),
  page: z.number().int().min(1, "Page must be at least 1."),
  pagesToDownload: z.number().int().min(1, "Pages to download must be at least 1."),
});

type SearchFormValues = z.infer<typeof searchSchema>;

type DownloadFeedback = {
  tone: "success" | "error";
  message: string;
};

const categoryOptions: Array<{ value: WallhavenCategoryFilter; label: string }> = [
  { value: "all", label: "All categories" },
  { value: "general", label: "General only" },
  { value: "anime", label: "Anime only" },
  { value: "people", label: "People only" },
  { value: "ga", label: "General + Anime" },
  { value: "gp", label: "General + People" },
];

const purityOptions = [
  { value: "sfw", label: "SFW" },
  { value: "sketchy", label: "Sketchy" },
  { value: "nsfw", label: "NSFW" },
  { value: "ws", label: "SFW + Sketchy" },
  { value: "wn", label: "SFW + NSFW" },
  { value: "sn", label: "Sketchy + NSFW" },
  { value: "all", label: "All purity levels" },
] as const;

const sortingOptions = [
  { value: "date_added", label: "Date added" },
  { value: "toplist", label: "Toplist" },
] as const;

const toplistOptions: Array<{ value: WallhavenToplistRange; label: string }> = [
  { value: "1d", label: "Past day" },
  { value: "3d", label: "Past 3 days" },
  { value: "1w", label: "Past week" },
  { value: "1M", label: "Past month" },
  { value: "3M", label: "Past 3 months" },
  { value: "6M", label: "Past 6 months" },
  { value: "1y", label: "Past year" },
];

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function buildPurityFilter(purityPreset: SearchFormValues["purityPreset"]): WallhavenPurityFilter {
  switch (purityPreset) {
    case "sfw":
      return { sfw: true, sketchy: false, nsfw: false };
    case "sketchy":
      return { sfw: false, sketchy: true, nsfw: false };
    case "nsfw":
      return { sfw: false, sketchy: false, nsfw: true };
    case "ws":
      return { sfw: true, sketchy: true, nsfw: false };
    case "wn":
      return { sfw: true, sketchy: false, nsfw: true };
    case "sn":
      return { sfw: false, sketchy: true, nsfw: true };
    case "all":
      return { sfw: true, sketchy: true, nsfw: true };
  }
}

function buildSearchFilters(values: SearchFormValues): WallhavenQueryFilters {
  const baseFilters = {
    categories: values.category,
    purity: buildPurityFilter(values.purityPreset),
    q: values.q.trim(),
    page: values.page,
  };

  if (values.sorting === "toplist") {
    return {
      ...baseFilters,
      sorting: "toplist",
      topRange: values.topRange,
    };
  }

  return {
    ...baseFilters,
    sorting: "date_added",
  };
}

function buildFiltersForPage(filters: WallhavenQueryFilters, page: number): WallhavenQueryFilters {
  return {
    ...filters,
    page,
  } as WallhavenQueryFilters;
}

function getFallbackFileExtension(fileType: string): string {
  switch (fileType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "img";
  }
}

function buildDownloadFileName(wallpaper: SearchWallpaper): string {
  try {
    const pathSegments = new URL(wallpaper.path).pathname
      .split("/")
      .filter(Boolean);
    const fileName = pathSegments[pathSegments.length - 1]?.trim();

    if (fileName) {
      return fileName;
    }
  } catch {
    // Fall back to a deterministic name below when the upstream URL is malformed.
  }

  return `wallhaven-${wallpaper.id}.${getFallbackFileExtension(wallpaper.fileType)}`;
}

function chunkWallpapers(wallpapers: SearchWallpaper[], chunkSize: number): SearchWallpaper[][] {
  const chunks: SearchWallpaper[][] = [];

  for (let index = 0; index < wallpapers.length; index += chunkSize) {
    chunks.push(wallpapers.slice(index, index + chunkSize));
  }

  return chunks;
}

function formatWallpaperCount(count: number): string {
  return `${count} wallpaper${count === 1 ? "" : "s"}`;
}

export function SearchPage() {
  const initialSessionSnapshot = getSearchPageSessionSnapshot();
  const { formState, handleSubmit, register, watch } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: initialSessionSnapshot?.formValues ?? {
      category: "all",
      purityPreset: "sfw",
      sorting: "date_added",
      topRange: "1M",
      q: "",
      page: 1,
      pagesToDownload: 1,
    },
  });
  const [result, setResult] = useState<SearchWallpapersResponse | null>(
    initialSessionSnapshot?.result ?? null,
  );
  const [searchError, setSearchError] = useState<string | null>(
    initialSessionSnapshot?.searchError ?? null,
  );
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null);
  const [downloadingWallpaperIds, setDownloadingWallpaperIds] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<WallhavenQueryFilters | null>(
    initialSessionSnapshot?.activeFilters ?? null,
  );
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const isActiveRef = useRef(true);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const formValues = watch();

  useEffect(() => {
    saveSearchPageSessionSnapshot({
      formValues,
      result,
      searchError,
      activeFilters,
    });
  }, [activeFilters, formValues, result, searchError]);
  const sorting = formValues.sorting;
  const pagesToDownload = formValues.pagesToDownload ?? 1;
  const topRangeVisible = sorting === "toplist";
  const downloadingWallpaperIdSet = useMemo(
    () => new Set(downloadingWallpaperIds),
    [downloadingWallpaperIds],
  );
  const resultCountLabel = useMemo(() => {
    if (!result || result.data.length === 0) {
      return null;
    }

    return `Loaded ${formatWallpaperCount(result.data.length)} from Wallhaven.`;
  }, [result]);
  const bulkDownloadLabel = useMemo(() => {
    if (isBulkDownloading) {
      return "Downloading current query...";
    }

    if (pagesToDownload > 1) {
      return `Download ${pagesToDownload} pages`;
    }

    return "Download current query";
  }, [isBulkDownloading, pagesToDownload]);

  const onSubmit = handleSubmit(async (values) => {
    setSearchError(null);
    setResult(null);
    setDownloadFeedback(null);

    try {
      const filters = buildSearchFilters(values);
      const nextResult = await searchWallpapersInService(filters);
      setResult(nextResult);
      setActiveFilters(filters);
    } catch (error) {
      setSearchError(getErrorMessage(error, "Search failed."));
      setActiveFilters(null);
    }
  });

  const onDownload = async (wallpaper: SearchWallpaper) => {
    const fileName = buildDownloadFileName(wallpaper);

    setDownloadingWallpaperIds((currentIds) =>
      currentIds.includes(wallpaper.id) ? currentIds : [...currentIds, wallpaper.id],
    );
    setDownloadFeedback({
      tone: "success",
      message: `${fileName} download started. Open Downloads to monitor live progress.`,
    });

    try {
      await downloadWallpaperInService({
        wallpaperId: wallpaper.id,
        imageUrl: wallpaper.path,
        fileName,
      });

      if (!isActiveRef.current) {
        return;
      }

      setDownloadFeedback({
        tone: "success",
        message: `${fileName} finished downloading. Open Downloads to review task history.`,
      });
    } catch (error) {
      if (!isActiveRef.current) {
        return;
      }

      setDownloadFeedback({
        tone: "error",
        message: getErrorMessage(error, "Download failed."),
      });
    } finally {
      if (isActiveRef.current) {
        setDownloadingWallpaperIds((currentIds) =>
          currentIds.filter((currentId) => currentId !== wallpaper.id),
        );
      }
    }
  };

  const onBulkDownload = async () => {
    if (!result || !activeFilters || isBulkDownloading) {
      return;
    }

    setIsBulkDownloading(true);
    setDownloadFeedback({
      tone: "success",
      message: `Starting bulk download from page ${activeFilters.page} for ${pagesToDownload} page${pagesToDownload === 1 ? "" : "s"}.`,
    });

    const firstPage = activeFilters.page ?? 1;
    const lastPage = Math.max(firstPage, result.meta.lastPage || firstPage);
    const finalPage = Math.min(firstPage + pagesToDownload - 1, lastPage);
    let processedWallpapers = 0;
    let successfulDownloads = 0;
    let failedDownloads = 0;

    try {
      for (let page = firstPage; page <= finalPage; page += 1) {
        const pageResult =
          page === firstPage
            ? result
            : await searchWallpapersInService(buildFiltersForPage(activeFilters, page));

        for (const chunk of chunkWallpapers(pageResult.data, BULK_DOWNLOAD_CONCURRENCY)) {
          const activeWallpaperIds = chunk.map((wallpaper) => wallpaper.id);
          setDownloadingWallpaperIds((currentIds) => [
            ...new Set([...currentIds, ...activeWallpaperIds]),
          ]);

          const settledDownloads = await Promise.allSettled(
            chunk.map(async (wallpaper) => {
              await downloadWallpaperInService({
                wallpaperId: wallpaper.id,
                imageUrl: wallpaper.path,
                fileName: buildDownloadFileName(wallpaper),
              });
            }),
          );

          processedWallpapers += settledDownloads.length;
          successfulDownloads += settledDownloads.filter(
            (download) => download.status === "fulfilled",
          ).length;
          failedDownloads += settledDownloads.filter(
            (download) => download.status === "rejected",
          ).length;

          if (isActiveRef.current) {
            setDownloadFeedback({
              tone: failedDownloads > 0 ? "error" : "success",
              message: `Bulk download progress: ${processedWallpapers} finished, ${failedDownloads} failed.`,
            });
            setDownloadingWallpaperIds((currentIds) =>
              currentIds.filter((currentId) => !activeWallpaperIds.includes(currentId)),
            );
          }
        }
      }

      if (isActiveRef.current) {
        const summary =
          failedDownloads === 0
            ? `Finished downloading ${formatWallpaperCount(successfulDownloads)}. Open Downloads to review task history.`
            : `Finished downloading ${formatWallpaperCount(successfulDownloads)}; ${failedDownloads} failed. Open Downloads to review task history.`;

        setDownloadFeedback({
          tone: failedDownloads > 0 ? "error" : "success",
          message: summary,
        });
      }
    } catch (error) {
      if (isActiveRef.current) {
        setDownloadFeedback({
          tone: "error",
          message: getErrorMessage(error, "Bulk download failed."),
        });
      }
    } finally {
      if (isActiveRef.current) {
        setIsBulkDownloading(false);
        setDownloadingWallpaperIds([]);
      }
    }
  };

  return (
    <section className="space-y-6">
      <PageHeading
        badge="Search + batch download backed"
        description="Search and batch download the current query."
        eyebrow="Wallpaper discovery"
        title="Search"
      />

      <form
        className="rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Filters</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Keep the current page for previewing results, then choose how many pages the bulk action
              should download from the same query.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={formState.isSubmitting || isBulkDownloading} type="submit">
              {formState.isSubmitting ? "Searching..." : "Search wallpapers"}
            </Button>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {formState.isSubmitting ? "Submitting search request..." : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Category</span>
            <select
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              {...register("category")}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Purity</span>
            <select
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              {...register("purityPreset")}
            >
              {purityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Sorting</span>
            <select
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              {...register("sorting")}
            >
              {sortingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Page</span>
            <input
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              min={1}
              onFocus={(event) => event.currentTarget.select()}
              step={1}
              type="number"
              {...register("page", { valueAsNumber: true })}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span>Pages to download</span>
            <input
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              min={1}
              onFocus={(event) => event.currentTarget.select()}
              step={1}
              type="number"
              {...register("pagesToDownload", { valueAsNumber: true })}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground xl:col-span-2">
            <span>Query</span>
            <input
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              placeholder="Optional keyword search"
              {...register("q")}
            />
          </label>

          {topRangeVisible ? (
            <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2 xl:col-span-2">
              <span>Toplist range</span>
              <select
                className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                {...register("topRange")}
              >
                {toplistOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {formState.errors.page ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {formState.errors.page.message}
          </p>
        ) : null}
        {formState.errors.pagesToDownload ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {formState.errors.pagesToDownload.message}
          </p>
        ) : null}
      </form>

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Results</h3>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Preview the current page, then download the active query across one or more pages with a
              single action.
            </p>
          </div>
          {result && result.data.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                Starting at page {activeFilters?.page ?? result.meta.currentPage} · downloading {pagesToDownload} page{pagesToDownload === 1 ? "" : "s"}
              </div>
              <Button
                disabled={formState.isSubmitting || isBulkDownloading}
                onClick={() => {
                  void onBulkDownload();
                }}
                type="button"
              >
                {bulkDownloadLabel}
              </Button>
            </div>
          ) : null}
        </div>

        {searchError ? (
          <div
            className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {searchError}
          </div>
        ) : null}

        {downloadFeedback ? (
          <div
            className={
              downloadFeedback.tone === "error"
                ? "rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                : "rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
            }
            role={downloadFeedback.tone === "error" ? "alert" : "status"}
          >
            {downloadFeedback.message}
          </div>
        ) : null}

        {!searchError && resultCountLabel ? (
          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
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
              void onDownload(wallpaper);
            }}
            wallpapers={result.data}
          />
        ) : null}

        {!searchError && !result ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
            Submit the form to load results from the Rust search command, then use the bulk action to
            download the current query.
          </div>
        ) : null}
      </section>
    </section>
  );
}
