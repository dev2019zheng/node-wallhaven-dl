import type { ComponentProps } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  VALID_TOPLIST_RANGES,
  type WallhavenCategoryFilter,
  type WallhavenToplistRange,
} from "@/domain/wallhaven/models";

import type { SearchPageFormValues } from "../search-page-session";

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
  { value: VALID_TOPLIST_RANGES[0], label: "Past day" },
  { value: VALID_TOPLIST_RANGES[1], label: "Past 3 days" },
  { value: VALID_TOPLIST_RANGES[2], label: "Past week" },
  { value: VALID_TOPLIST_RANGES[3], label: "Past month" },
  { value: VALID_TOPLIST_RANGES[4], label: "Past 3 months" },
  { value: VALID_TOPLIST_RANGES[5], label: "Past 6 months" },
  { value: VALID_TOPLIST_RANGES[6], label: "Past year" },
];

type SearchFiltersProps = {
  errors: FieldErrors<SearchPageFormValues>;
  isBulkDownloading: boolean;
  isSubmitting: boolean;
  onSubmit: ComponentProps<"form">["onSubmit"];
  register: UseFormRegister<SearchPageFormValues>;
  sorting: SearchPageFormValues["sorting"];
};

export function SearchFilters({
  errors,
  isBulkDownloading,
  isSubmitting,
  onSubmit,
  register,
  sorting,
}: SearchFiltersProps) {
  const topRangeVisible = sorting === "toplist";

  return (
    <section
      aria-label="Search filters"
      className="app-panel overflow-hidden border-border/90 bg-card/88 p-4 lg:p-5"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Search filters
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              预览当前页结果，并控制批量下载范围。
            </p>
          </div>
          <Button className="min-w-[8rem] rounded-xl" disabled={isSubmitting || isBulkDownloading} type="submit">
            {isSubmitting ? "搜索中..." : "搜索"}
          </Button>
        </div>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            关键词
          </span>
          <input
            aria-invalid={errors.q ? true : undefined}
            className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
            placeholder="输入关键词、颜色、分辨率..."
            {...register("q")}
          />
          {errors.q ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.q.message}
            </p>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              分类
            </span>
            <select
              className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              纯净度
            </span>
            <select
              className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              排序
            </span>
            <select
              className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              起始页
            </span>
            <input
              className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
              min={1}
              onFocus={(event) => event.currentTarget.select()}
              step={1}
              type="number"
              {...register("page", { valueAsNumber: true })}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              批量页数
            </span>
            <input
              className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
              min={1}
              onFocus={(event) => event.currentTarget.select()}
              step={1}
              type="number"
              {...register("pagesToDownload", { valueAsNumber: true })}
            />
          </label>

          {topRangeVisible ? (
            <label className="space-y-2 text-sm font-medium text-foreground">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                热榜范围
              </span>
              <select
                className="h-10 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
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

        {errors.page ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.page.message}
          </p>
        ) : null}
        {errors.pagesToDownload ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.pagesToDownload.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
