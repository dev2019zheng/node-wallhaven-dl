import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Loader2, Save, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
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
  return `${count} 张壁纸`;
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

    return `当前页已加载 ${formatWallpaperCount(result.data.length)}。`;
  }, [result]);
  const bulkDownloadLabel = useMemo(() => {
    if (isBulkDownloading) {
      return "下载当前查询中...";
    }

    if (pagesToDownload > 1) {
      return `下载 ${pagesToDownload} 页`;
    }

    return "下载当前查询";
  }, [isBulkDownloading, pagesToDownload]);
  const resultSummaryLabel = useMemo(() => {
    if (!result) {
      return null;
    }

    return `${result.meta.total.toLocaleString()} results · Page ${result.meta.currentPage} of ${result.meta.lastPage}`;
  }, [result]);
  const inspectorWallpaper = selectedWallpapers[0] ?? null;

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
      message: `${downloadRequest.fileName} 已开始下载，请前往 Downloads 查看进度。`,
    });

    try {
      await downloadWallpaperInService(downloadRequest);

      if (!isActiveRef.current) {
        return;
      }

      setDownloadFeedback({
        tone: "success",
        message: `${downloadRequest.fileName} 下载完成，请前往 Downloads 查看任务记录。`,
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
            ? `Finished downloading ${formatWallpaperCount(successfulDownloads)} from the current selection. 前往 Downloads 查看 review task history.`
            : `Finished downloading ${formatWallpaperCount(successfulDownloads)} from the current selection; ${failedDownloads} failed. 前往 Downloads 查看 review task history.`;

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
            ? `Finished downloading ${formatWallpaperCount(successfulDownloads)}. 前往 Downloads 查看 review task history.`
            : `Finished downloading ${formatWallpaperCount(successfulDownloads)}; ${failedDownloads} failed. 前往 Downloads 查看 review task history.`;

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
        badge="API synced"
        description="Search and discover wallpapers from Wallhaven."
        eyebrow="Wallpaper discovery"
        title="Search"
      />

      <div className="grid grid-cols-[932px_210px] items-start gap-[26px]">
        <div className="min-w-0 space-y-6">
          <section aria-label="Search filters">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-[1fr_122px] gap-[18px]">
              <label className="relative block" htmlFor="search-query">
                <SearchIcon className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  aria-invalid={formState.errors.q ? true : undefined}
                  aria-label="关键词"
                  className="wh-control h-[42px] w-full pl-12 pr-4 text-[13px]"
                  id="search-query"
                  placeholder="Search for wallpapers  (e.g. mountains, anime, space...)"
                  {...register("q")}
                />
              </label>
              <Button
                aria-label="搜索"
                className="h-[42px] rounded-[14px] text-[14px]"
                disabled={formState.isSubmitting || isBulkDownloading}
                type="submit"
              >
                {formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Search
              </Button>
            </div>

            {formState.errors.q ? (
              <p className="-mt-2 text-[12px] text-destructive" role="alert">
                {formState.errors.q.message}
              </p>
            ) : null}

            <div className="grid grid-cols-[repeat(5,1fr)_142px] gap-[12px]">
              <label className="wh-control flex h-[54px] flex-col justify-center px-4" htmlFor="search-category">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Category</span>
                <select aria-label="分类" className="bg-transparent text-[13px] font-semibold outline-none" id="search-category" {...register("category")}>
                  <option value="all">All</option>
                  <option value="general">General</option>
                  <option value="anime">Anime</option>
                  <option value="people">People</option>
                  <option value="ga">General + Anime</option>
                  <option value="gp">General + People</option>
                </select>
              </label>
              <label className="wh-control flex h-[54px] flex-col justify-center px-4" htmlFor="search-purity">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Purity</span>
                <select aria-label="纯净度" className="bg-transparent text-[13px] font-semibold outline-none" id="search-purity" {...register("purityPreset")}>
                  <option value="sfw">SFW</option>
                  <option value="sketchy">Sketchy</option>
                  <option value="nsfw">NSFW</option>
                  <option value="ws">SFW + Sketchy</option>
                  <option value="wn">SFW + NSFW</option>
                  <option value="sn">Sketchy + NSFW</option>
                  <option value="all">All purity levels</option>
                </select>
              </label>
              <label className="wh-control flex h-[54px] flex-col justify-center px-4" htmlFor="search-sorting">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Sorting</span>
                <select aria-label="排序" className="bg-transparent text-[13px] font-semibold outline-none" id="search-sorting" {...register("sorting")}>
                  <option value="date_added">Date added</option>
                  <option value="toplist">Toplist</option>
                </select>
              </label>
              <div className="wh-control flex h-[54px] flex-col justify-center px-4" aria-label="Resolution">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Resolution</span>
                <span className="text-[13px] font-semibold">All</span>
              </div>
              <div className="wh-control flex h-[54px] flex-col justify-center px-4" aria-label="Aspect Ratio">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Aspect Ratio</span>
                <span className="text-[13px] font-semibold">16:9</span>
              </div>
              <label className="wh-control flex h-[54px] flex-col justify-center px-4" htmlFor="search-top-range">
                <span className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">More Filters</span>
                <span className="flex items-center justify-between gap-3">
                  {formValues.sorting === "toplist" ? (
                    <select aria-label="热榜范围" className="min-w-0 bg-transparent text-[13px] font-semibold outline-none" id="search-top-range" {...register("topRange")}>
                      <option value="1M">Advanced</option>
                      <option value="1d">Past day</option>
                      <option value="3d">Past 3 days</option>
                      <option value="1w">Past week</option>
                      <option value="3M">Past 3 months</option>
                      <option value="6M">Past 6 months</option>
                      <option value="1y">Past year</option>
                    </select>
                  ) : (
                    <span className="text-[13px] font-semibold">Advanced</span>
                  )}
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                </span>
              </label>
            </div>
          </form>
          </section>

          <section aria-label="Search results" className="space-y-4">
            <div className="flex h-[42px] items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-[14px] font-semibold text-foreground">
                  {resultSummaryLabel ?? "Start with a query"}
                </h3>
                {result ? (
                  <span className="text-[13px] font-medium text-muted-foreground">
                    Page {result.meta.currentPage} of {result.meta.lastPage}
                  </span>
                ) : null}
              </div>
              {result && result.data.length > 0 ? (
                <div className="flex items-center gap-3">
                  <Button
                    aria-label={bulkDownloadLabel}
                    className="h-[42px] rounded-[14px] px-4"
                    disabled={formState.isSubmitting || isBulkDownloading}
                    onClick={() => {
                      void onBulkDownload();
                    }}
                    type="button"
                  >
                    {isBulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    <span className="sr-only">{bulkDownloadLabel}</span>
                  </Button>
                  <div className="wh-control flex h-[42px] w-[126px] items-center justify-between px-4 text-[13px] font-semibold">
                    24 per page
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <button aria-label="Grid view" className="wh-icon-button h-[42px] w-[42px]" type="button">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                  </button>
                </div>
              ) : null}
            </div>

            {searchError ? <ErrorState message={searchError} /> : null}

            {downloadFeedback ? (
              <div
                className={
                  downloadFeedback.tone === "error"
                    ? "rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive"
                    : "rounded-[14px] border border-emerald-500/35 bg-emerald-500/12 px-4 py-3 text-[13px] font-medium text-emerald-200"
                }
                role={downloadFeedback.tone === "error" ? "alert" : "status"}
              >
                {downloadFeedback.message}
              </div>
            ) : null}

            {!searchError && resultCountLabel ? (
              <div className="sr-only">{resultCountLabel}</div>
            ) : null}

            {formState.isSubmitting ? (
              <div className="grid grid-cols-3 gap-[18px]" aria-label="Loading search results">
                {Array.from({ length: 9 }, (_, index) => (
                  <div className="h-[156px] animate-pulse rounded-2xl border border-border bg-[var(--surface-deep)]" key={index} />
                ))}
              </div>
            ) : null}

            {!searchError && !formState.isSubmitting && result && result.data.length === 0 ? (
              <EmptyState title="No wallpapers matched the current filters." />
            ) : null}

            {!searchError && !formState.isSubmitting && result && result.data.length > 0 ? (
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
            ) : null}

            {!searchError && !formState.isSubmitting && !result ? (
              <EmptyState
                description="Try mountains, anime, city night, space, or 4K landscape."
                title="Start with a query"
              />
            ) : null}
          </section>
        </div>

        <aside className="app-panel min-h-[716px] space-y-6 p-6" aria-label="Inspector">
          <div className="space-y-2">
            <h3 className="text-[20px] font-semibold leading-7 text-foreground">Inspector</h3>
            <p className="text-[13px] font-medium text-muted-foreground">
              {selectedWallpapers.length > 0
                ? `Selected ${selectedWallpapers.length} wallpapers`
                : "Start with a query"}
            </p>
          </div>

          {selectedWallpapers.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-border bg-[var(--surface-deep)] p-4">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Batch action</p>
                <p className="mt-3 text-[16px] font-semibold text-foreground">Download selected</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  已选择 {selectedWallpapers.length} 项 · {selectedWallpapers.length} files
                </p>
              </div>
              <Button
                aria-label={isSelectedDownloading ? "下载选中中..." : "下载选中"}
                className="h-12 w-full rounded-[14px]"
                disabled={isSelectedDownloading || isBulkDownloading}
                onClick={() => {
                  void onDownloadSelected();
                }}
                type="button"
              >
                {isSelectedDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Start download
              </Button>
              <Button className="h-12 w-full rounded-[14px]" type="button" variant="outline">
                <Save className="h-4 w-4" />
                Save to collection
              </Button>
              <Button
                aria-label="清除选择"
                className="h-10 w-full rounded-[14px]"
                disabled={isSelectedDownloading}
                onClick={clearSelectedSearchIds}
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
                Clear selection
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-border bg-[var(--surface-deep)] p-4 text-[13px] leading-6 text-muted-foreground">
                Search, then click the selection badge on cards to enable batch actions here.
              </div>
              <Button
                aria-label="Start bulk download from inspector"
                className="h-12 w-full rounded-[14px]"
                disabled={!result || result.data.length === 0 || formState.isSubmitting || isBulkDownloading}
                onClick={() => {
                  void onBulkDownload();
                }}
                type="button"
              >
                {isBulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {bulkDownloadLabel}
              </Button>
              <label className="block space-y-2 text-[12px] font-semibold text-muted-foreground">
                起始页
                <input
                  className="wh-control h-10 w-full px-3 text-[13px] text-foreground"
                  min={1}
                  type="number"
                  {...register("page", { valueAsNumber: true })}
                />
              </label>
              <label className="block space-y-2 text-[12px] font-semibold text-muted-foreground">
                批量页数
                <input
                  className="wh-control h-10 w-full px-3 text-[13px] text-foreground"
                  min={1}
                  type="number"
                  {...register("pagesToDownload", { valueAsNumber: true })}
                />
              </label>
            </div>
          )}

          {inspectorWallpaper ? (
            <dl className="space-y-6 text-[13px]">
              <div>
                <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Resolution</dt>
                <dd className="mt-2 text-foreground">{inspectorWallpaper.resolution}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Purity</dt>
                <dd className="mt-2 uppercase text-foreground">{inspectorWallpaper.purity}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Ratio</dt>
                <dd className="mt-2 text-foreground">{inspectorWallpaper.ratio}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase text-muted-foreground">Tags</dt>
                <dd className="mt-2 text-foreground">space, city, nature</dd>
              </div>
            </dl>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
