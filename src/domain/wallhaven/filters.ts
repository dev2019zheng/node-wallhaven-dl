import {
  LEGACY_CATEGORY_CODES,
  LEGACY_PURITY_CODES,
  VALID_SORTINGS,
  VALID_TOPLIST_RANGES,
  type WallhavenCategoryCode,
  type WallhavenCategoryFilter,
  type WallhavenPurityCode,
  type WallhavenPurityFilter,
  type WallhavenSorting,
  type WallhavenToplistRange,
} from "./models";

const SUPPORTED_CATEGORY_FILTERS = new Set<WallhavenCategoryFilter>(
  Object.keys(LEGACY_CATEGORY_CODES) as WallhavenCategoryFilter[],
);
const SUPPORTED_PURITY_CODES = new Set<WallhavenPurityCode>(
  Object.values(LEGACY_PURITY_CODES),
);
const VALID_SORTING_SET = new Set<WallhavenSorting>(VALID_SORTINGS);
const VALID_TOPLIST_RANGE_SET = new Set<WallhavenToplistRange>(VALID_TOPLIST_RANGES);

function encodeFlag(enabled: boolean): "0" | "1" {
  return enabled ? "1" : "0";
}

export function isValidCategoryFilter(filter: unknown): filter is WallhavenCategoryFilter {
  return (
    typeof filter === "string" &&
    SUPPORTED_CATEGORY_FILTERS.has(filter as WallhavenCategoryFilter)
  );
}

export function assertValidCategoryFilter(filter: unknown): WallhavenCategoryFilter {
  if (!isValidCategoryFilter(filter)) {
    throw new Error(`Invalid category filter: ${String(filter)}`);
  }

  return filter;
}

export function encodeCategories(
  categories: WallhavenCategoryFilter,
): WallhavenCategoryCode {
  const filter = assertValidCategoryFilter(categories);
  return LEGACY_CATEGORY_CODES[filter];
}

export function encodePurities(purity: WallhavenPurityFilter): WallhavenPurityCode {
  const code = [purity.sfw, purity.sketchy, purity.nsfw]
    .map(encodeFlag)
    .join("");

  if (!SUPPORTED_PURITY_CODES.has(code as WallhavenPurityCode)) {
    throw new Error("At least one purity must be selected");
  }

  return code as WallhavenPurityCode;
}

export function isValidSorting(sorting: unknown): sorting is WallhavenSorting {
  return typeof sorting === "string" && VALID_SORTING_SET.has(sorting as WallhavenSorting);
}

export function assertValidSorting(sorting: unknown): WallhavenSorting {
  if (!isValidSorting(sorting)) {
    throw new Error(`Invalid sorting: ${String(sorting)}`);
  }

  return sorting;
}

export function isValidToplistRange(range: unknown): range is WallhavenToplistRange {
  return (
    typeof range === "string" &&
    VALID_TOPLIST_RANGE_SET.has(range as WallhavenToplistRange)
  );
}

export function assertValidToplistRange(range: unknown): WallhavenToplistRange {
  if (!isValidToplistRange(range)) {
    throw new Error(`Invalid toplist range: ${String(range)}`);
  }

  return range;
}
