import type {
  WallhavenCategoryFilter,
  WallhavenNonToplistSorting,
  WallhavenPurityFilter,
  WallhavenQueryFilters,
  WallhavenToplistRange,
} from "@/domain/wallhaven/models";

interface SearchWallpapersCommandPayloadBase {
  categories?: WallhavenCategoryFilter;
  purity?: WallhavenPurityFilter;
  q?: string;
  page?: number;
  apiKey?: string;
}

export interface SearchWallpapersToplistCommandPayload
  extends SearchWallpapersCommandPayloadBase {
  sorting: "toplist";
  topRange: WallhavenToplistRange;
}

export interface SearchWallpapersNonToplistCommandPayload
  extends SearchWallpapersCommandPayloadBase {
  sorting?: WallhavenNonToplistSorting;
  topRange?: never;
}

export type SearchWallpapersCommandPayload =
  | SearchWallpapersToplistCommandPayload
  | SearchWallpapersNonToplistCommandPayload;

export interface BuildSearchWallpapersCommandPayloadOptions {
  apiKey?: string;
}

function normalizeApiKey(apiKey: string | undefined): string | undefined {
  const normalizedApiKey = apiKey?.trim();
  return normalizedApiKey ? normalizedApiKey : undefined;
}

function buildCommandPayloadBase(
  filters: WallhavenQueryFilters,
  options: BuildSearchWallpapersCommandPayloadOptions,
): SearchWallpapersCommandPayloadBase {
  const payload: SearchWallpapersCommandPayloadBase = {};

  if (filters.categories !== undefined) {
    payload.categories = filters.categories;
  }

  if (filters.purity !== undefined) {
    payload.purity = { ...filters.purity };
  }

  if (filters.q !== undefined) {
    payload.q = filters.q;
  }

  if (filters.page !== undefined) {
    payload.page = filters.page;
  }

  const apiKey = normalizeApiKey(options.apiKey);
  if (apiKey !== undefined) {
    payload.apiKey = apiKey;
  }

  return payload;
}

export function buildSearchWallpapersCommandPayload(
  filters: WallhavenQueryFilters,
  options: BuildSearchWallpapersCommandPayloadOptions = {},
): SearchWallpapersCommandPayload {
  const payload = buildCommandPayloadBase(filters, options);

  if (filters.sorting === "toplist") {
    return {
      ...payload,
      sorting: "toplist",
      topRange: filters.topRange,
    };
  }

  if (filters.sorting !== undefined) {
    return {
      ...payload,
      sorting: filters.sorting,
    };
  }

  return payload;
}
