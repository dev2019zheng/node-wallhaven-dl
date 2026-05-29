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
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useUiShellStore } from "@/features/shell/ui-shell-store";
import {
  VALID_TOPLIST_RANGES,
  type WallhavenPurityFilter,
  type WallhavenQueryFilters,
} from "@/domain/wallhaven/models";

import { SearchFilters } from "./components/SearchFilters";
import { StickySelectionBar } from "./components/StickySelectionBar";
import { WallpaperGrid } from "./components/WallpaperGrid";
import {
  getSearchPageSessionSnapshot,
  saveSearchPageSessionSnapshot,
  type SearchPageFormValues,
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

type DownloadFeedback = {
  tone: "success" | "error";
  message: string;
};

type DownloadActivityCounts = Record<string, number>;

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function buildPurityFilter(purityPreset: SearchPageFormValues["purityPreset"]): WallhavenPurityFilter {
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

function buildSearchFilters(values: SearchPageFormValues): WallhavenQueryFilters {
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

function areFormValuesEqual(
  left: SearchPageFormValues | null,
  right: SearchPageFormValues | null,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.category === right.category &&
    left.purityPreset === right.purityPreset &&
    left.sorting === right.sorting &&
    left.topRange === right.topRange &&
    left.q === right.q &&
    left.page === right.page &&
    left.pagesToDownload === right.pagesToDownload
  );
}

function getRestoredSearchState(snapshot: ReturnType<typeof getSearchPageSessionSnapshot>) {
  if (!snapshot) {
    return {
      activeFilters: null,
      result: null,
      searchError: null,
    };
  }

  if (!areFormValuesEqual(snapshot.formValues, snapshot.submittedFormValues)) {
    return {
      activeFilters: null,
      result: null,
      searchError: null,
    };
  }

  return {
    activeFilters: snapshot.activeFilters,
    result: snapshot.result,
    searchError: snapshot.searchError,
  };
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

function buildWallpaperDownloadRequest(wallpaper: SearchWallpaper) {
  return {
    wallpaperId: wallpaper.id,
    imageUrl: wallpaper.path,
    fileName: buildDownloadFileName(wallpaper),
  };
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

function filterOutDownloadingWallpapers(
  wallpapers: SearchWallpaper[],
  downloadingWallpaperIds: ReadonlySet<string>,
): SearchWallpaper[] {
  return wallpapers.filter((wallpaper) => !downloadingWallpaperIds.has(wallpaper.id));
}

function incrementDownloadActivity(
  currentCounts: DownloadActivityCounts,
  wallpaperIds: Iterable<string>,
): DownloadActivityCounts {
  const nextCounts = { ...currentCounts };

  for (const wallpaperId of wallpaperIds) {
    nextCounts[wallpaperId] = (nextCounts[wallpaperId] ?? 0) + 1;
  }

  return nextCounts;
}

function decrementDownloadActivity(
  currentCounts: DownloadActivityCounts,
  wallpaperIds: Iterable<string>,
): DownloadActivityCounts {
  const nextCounts = { ...currentCounts };

  for (const wallpaperId of wallpaperIds) {
    const nextCount = (nextCounts[wallpaperId] ?? 0) - 1;

    if (nextCount > 0) {
      nextCounts[wallpaperId] = nextCount;
    } else {
      delete nextCounts[wallpaperId];
    }
  }

  return nextCounts;
}

export function SearchPage() {
  const initialSessionSnapshot = getSearchPageSessionSnapshot();
  const restoredSearchState = getRestoredSearchState(initialSessionSnapshot);
  const { formState, handleSubmit, register, watch } = useForm<SearchPageFormValues>({
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
  const [submittedFormValues, setSubmittedFormValues] = useState<SearchPageFormValues | null>(
    initialSessionSnapshot?.submittedFormValues ?? null,
  );
  const [result, setResult] = useState<SearchWallpapersResponse | null>(restoredSearchState.result);
  const [searchError, setSearchError] = useState<string | null>(restoredSearchState.searchError);
  const [downloadFeedback, setDownloadFeedback] = useState<DownloadFeedback | null>(null);
  const [downloadActivityCounts, setDownloadActivityCounts] = useState<DownloadActivityCounts>({});
  const [activeFilters, setActiveFilters] = useState<WallhavenQueryFilters | null>(
    restoredSearchState.activeFilters,
  );
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isSelectedDownloading, setIsSelectedDownloading] = useState(false);
  const selectedSearchIds = useUiShellStore((state) => state.selectedSearchIds);
  const setSelectedSearchIds = useUiShellStore((state) => state.setSelectedSearchIds);
  const clearSelectedSearchIds = useUiShellStore((state) => state.clearSelectedSearchIds);
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
      submittedFormValues,
      result,
      searchError,
      activeFilters,
    });
  }, [activeFilters, formValues, result, searchError, submittedFormValues]);

  const pagesToDownload = formValues.pagesToDownload ?? 1;
  const downloadingWallpaperIdSet = useMemo(
    () => new Set(Object.keys(downloadActivityCounts)),
    [downloadActivityCounts],
  );
  const selectedWallpaperSet = useMemo(() => new Set(selectedSearchIds), [selectedSearchIds]);
  const selectedWallpapers = useMemo(
    () => result?.data.filter((wallpaper) => selectedWallpaperSet.has(wallpaper.id)) ?? [],
    [result, selectedWallpaperSet],
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
    setSubmittedFormValues(values);
    clearSelectedSearchIds();

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

  const onToggleSelection = (wallpaperId: string, checked: boolean) => {
    if (isSelectedDownloading) {
      return;
    }

    if (checked) {
      if (!selectedSearchIds.includes(wallpaperId)) {
        setSelectedSearchIds([...selectedSearchIds, wallpaperId]);
      }

      return;
    }

    setSelectedSearchIds(selectedSearchIds.filter((selectedId) => selectedId !== wallpaperId));
  };

  const onDownload = async (wallpaper: SearchWallpaper) => {
    if (downloadingWallpaperIdSet.has(wallpaper.id)) {
      return;
    }

    const downloadRequest = buildWallpaperDownloadRequest(wallpaper);

    setDownloadActivityCounts((currentCounts) =>
      incrementDownloadActivity(currentCounts, [wallpaper.id]),
    );
    setDownloadFeedback({
      tone: "success",
      message: `${downloadRequest.fileName} download started. Open Downloads to monitor live progress.`,
    });

    try {
      await downloadWallpaperInService(downloadRequest);

      if (!isActiveRef.current) {
        return;
      }

      setDownloadFeedback({
        tone: "success",
        message: `${downloadRequest.fileName} finished downloading. Open Downloads to review task history.`,
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
        setDownloadActivityCounts((currentCounts) =>
          decrementDownloadActivity(currentCounts, [wallpaper.id]),
        );
      }
    }
  };

  const onDownloadSelected = async () => {
    if (selectedWallpapers.length === 0 || isSelectedDownloading || isBulkDownloading) {
      return;
    }

    const selectedWallpapersToDownload = filterOutDownloadingWallpapers(
      selectedWallpapers,
      downloadingWallpaperIdSet,
    );

    if (selectedWallpapersToDownload.length === 0) {
      return;
    }

    const selectedWallpaperIds = selectedWallpapersToDownload.map((wallpaper) => wallpaper.id);
    let processedWallpapers = 0;
    let successfulDownloads = 0;
    let failedDownloads = 0;

    setIsSelectedDownloading(true);
    setDownloadActivityCounts((currentCounts) =>
      incrementDownloadActivity(currentCounts, selectedWallpaperIds),
    );
    setDownloadFeedback({
      tone: "success",
      message: `Starting selected download for ${formatWallpaperCount(selectedWallpapersToDownload.length)}.`,
    });

    try {
      for (const chunk of chunkWallpapers(selectedWallpapersToDownload, BULK_DOWNLOAD_CONCURRENCY)) {
        const settledDownloads = await Promise.allSettled(
          chunk.map(async (wallpaper) => {
            await downloadWallpaperInService(buildWallpaperDownloadRequest(wallpaper));
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
            message: `Selected download progress: ${processedWallpapers} finished, ${failedDownloads} failed.`,
          });
        }
      }

      if (isActiveRef.current) {
        const summary =
          failedDownloads === 0
            ? `Finished downloading ${formatWallpaperCount(successfulDownloads)} from the current selection. Open Downloads to review task history.`
            : `Finished downloading ${formatWallpaperCount(successfulDownloads)} from the current selection; ${failedDownloads} failed. Open Downloads to review task history.`;

        setDownloadFeedback({
          tone: failedDownloads > 0 ? "error" : "success",
          message: summary,
        });
      }
    } catch (error) {
      if (isActiveRef.current) {
        setDownloadFeedback({
          tone: "error",
          message: getErrorMessage(error, "Selected download failed."),
        });
      }
    } finally {
      if (isActiveRef.current) {
        setIsSelectedDownloading(false);
        setDownloadActivityCounts((currentCounts) =>
          decrementDownloadActivity(currentCounts, selectedWallpaperIds),
        );
      }
    }
  };

  const onBulkDownload = async () => {
    if (!result || !activeFilters || isBulkDownloading) {
      return;
    }

    const visibleWallpapersToDownload = filterOutDownloadingWallpapers(
      result.data,
      downloadingWallpaperIdSet,
    );
    const visibleWallpaperIds = visibleWallpapersToDownload.map((wallpaper) => wallpaper.id);

    setIsBulkDownloading(true);
    setDownloadActivityCounts((currentCounts) =>
      incrementDownloadActivity(currentCounts, visibleWallpaperIds),
    );
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
        const pageWallpapersToDownload = filterOutDownloadingWallpapers(
          pageResult.data,
          downloadingWallpaperIdSet,
        );

        for (const chunk of chunkWallpapers(pageWallpapersToDownload, BULK_DOWNLOAD_CONCURRENCY)) {
          const settledDownloads = await Promise.allSettled(
            chunk.map(async (wallpaper) => {
              await downloadWallpaperInService(buildWallpaperDownloadRequest(wallpaper));
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
        setDownloadActivityCounts((currentCounts) =>
          decrementDownloadActivity(currentCounts, visibleWallpaperIds),
        );
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

      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] xl:items-start">
        <SearchFilters
          errors={formState.errors}
          isBulkDownloading={isBulkDownloading}
          isSubmitting={formState.isSubmitting}
          onSubmit={onSubmit}
          register={register}
          sorting={formValues.sorting}
        />

        <section
          aria-label="Search results"
          className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Results</h3>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Preview the current page, then download the active query across one or more pages
                with a single action.
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

          {searchError ? <ErrorState message={searchError} /> : null}

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
            <EmptyState title="No wallpapers matched the current filters." />
          ) : null}

          {!searchError && result && result.data.length > 0 ? (
            <>
              {selectedWallpapers.length > 0 ? (
                <StickySelectionBar
                  isDownloading={isSelectedDownloading}
                  onClear={clearSelectedSearchIds}
                  onDownloadSelected={() => {
                    void onDownloadSelected();
                  }}
                  selectedCount={selectedWallpapers.length}
                />
              ) : null}

              <WallpaperGrid
                downloadingWallpaperIds={downloadingWallpaperIdSet}
                onDownload={(wallpaper) => {
                  void onDownload(wallpaper);
                }}
                onToggleSelection={onToggleSelection}
                selectedWallpaperIds={selectedWallpaperSet}
                selectionDisabled={isSelectedDownloading}
                wallpapers={result.data}
              />
            </>
          ) : null}

          {!searchError && !result ? (
            <EmptyState
              description="Then use the bulk action to download the current query."
              title="Submit the form to load results from the Rust search command."
            />
          ) : null}
        </section>
      </div>
    </section>
  );
}
