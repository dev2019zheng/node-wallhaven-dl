import type {
  WallhavenCategoryFilter,
  WallhavenQueryFilters,
  WallhavenQueryParams,
} from "@/domain/wallhaven/models";

export const validCategoryPreset: WallhavenCategoryFilter = "ga";

export const validPresetQueryFilters: WallhavenQueryFilters = {
  categories: "general",
  sorting: "date_added",
};

export const validToplistQueryFilters: WallhavenQueryFilters = {
  categories: "gp",
  sorting: "toplist",
  topRange: "1M",
};

export const validToplistQueryParams: WallhavenQueryParams = {
  sorting: "toplist",
  topRange: "1w",
  order: "desc",
};

export const validDateAddedQueryParams: WallhavenQueryParams = {
  sorting: "date_added",
};

// @ts-expect-error boolean category triplets are no longer part of the public contract
export const invalidBooleanCategoryFilter: WallhavenQueryFilters = { categories: { general: true, anime: false, people: false } };

// @ts-expect-error toplist filters must provide a toplist range
export const invalidToplistWithoutRange: WallhavenQueryFilters = {
  sorting: "toplist",
};

// @ts-expect-error non-toplist filters cannot include a toplist range
export const invalidNonToplistWithRange: WallhavenQueryFilters = { sorting: "date_added", topRange: "1M" };

// @ts-expect-error unsupported sorting values should be rejected at the contract boundary
export const invalidSorting: WallhavenQueryFilters = { sorting: "favorites" };

// @ts-expect-error non-toplist params cannot expose toplist-only fields
export const invalidNonToplistParams: WallhavenQueryParams = { sorting: "date_added", topRange: "1M" };
