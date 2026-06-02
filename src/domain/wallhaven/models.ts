export const LEGACY_CATEGORY_CODES = {
  all: "111",
  anime: "010",
  general: "100",
  people: "001",
  ga: "110",
  gp: "101",
} as const;

export const LEGACY_PURITY_CODES = {
  sfw: "100",
  sketchy: "010",
  nsfw: "001",
  ws: "110",
  wn: "101",
  sn: "011",
  all: "111",
} as const;

export const VALID_SORTINGS = ["date_added", "toplist"] as const;
export const VALID_TOPLIST_RANGES = ["1d", "3d", "1w", "1M", "3M", "6M", "1y"] as const;

export type WallhavenCategoryFilter = keyof typeof LEGACY_CATEGORY_CODES;
export type WallhavenCategoryCode =
  (typeof LEGACY_CATEGORY_CODES)[WallhavenCategoryFilter];

export type WallhavenPurityCode =
  (typeof LEGACY_PURITY_CODES)[keyof typeof LEGACY_PURITY_CODES];

export type WallhavenSorting = (typeof VALID_SORTINGS)[number];
export type WallhavenToplistRange = (typeof VALID_TOPLIST_RANGES)[number];
export type WallhavenNonToplistSorting = Exclude<WallhavenSorting, "toplist">;

export interface WallhavenPurityFilter {
  sfw: boolean;
  sketchy: boolean;
  nsfw: boolean;
}

export interface WallhavenQueryFilterBase {
  categories?: WallhavenCategoryFilter;
  purity?: WallhavenPurityFilter;
  q?: string;
  page?: number;
  atLeast?: string;
  ratios?: string;
}

export interface WallhavenToplistQueryFilters extends WallhavenQueryFilterBase {
  sorting: "toplist";
  topRange: WallhavenToplistRange;
}

export interface WallhavenNonToplistQueryFilters extends WallhavenQueryFilterBase {
  sorting?: WallhavenNonToplistSorting;
  topRange?: never;
}

export type WallhavenQueryFilters =
  | WallhavenToplistQueryFilters
  | WallhavenNonToplistQueryFilters;

export interface WallhavenQueryParamsBase {
  categories?: WallhavenCategoryCode;
  purity?: WallhavenPurityCode;
  q?: string;
  page?: string;
  atleast?: string;
  ratios?: string;
}

export interface WallhavenToplistQueryParams extends WallhavenQueryParamsBase {
  sorting: "toplist";
  topRange: WallhavenToplistRange;
  order: "desc";
}

export interface WallhavenNonToplistQueryParams extends WallhavenQueryParamsBase {
  sorting?: WallhavenNonToplistSorting;
  topRange?: never;
  order?: never;
}

export type WallhavenQueryParams =
  | WallhavenToplistQueryParams
  | WallhavenNonToplistQueryParams;
