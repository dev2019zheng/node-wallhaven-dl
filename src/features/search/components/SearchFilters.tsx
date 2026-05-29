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
      className="rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm"
    >
      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Filters</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep the current page for previewing results, then choose how many pages the bulk
            action should download from the same query.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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

          <label className="space-y-2 text-sm font-medium text-foreground sm:col-span-2 xl:col-span-1">
            <span>Query</span>
            <input
              aria-invalid={errors.q ? true : undefined}
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              placeholder="Optional keyword search"
              {...register("q")}
            />
            {errors.q ? (
              <p className="text-sm text-destructive" role="alert">
                {errors.q.message}
              </p>
            ) : null}
          </label>

          {topRangeVisible ? (
            <label className="space-y-2 text-sm font-medium text-foreground sm:col-span-2 xl:col-span-1">
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

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isSubmitting || isBulkDownloading} type="submit">
            {isSubmitting ? "Searching..." : "Search wallpapers"}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {isSubmitting ? "Submitting search request..." : ""}
          </p>
        </div>
      </form>
    </section>
  );
}
