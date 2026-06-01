import {
  assertValidSorting,
  assertValidToplistRange,
  encodeCategories,
  encodePurities,
} from "./filters";
import type {
  WallhavenQueryFilters,
  WallhavenQueryParams,
  WallhavenQueryParamsBase,
} from "./models";

function buildWallhavenQueryParamsBase(
  filters: WallhavenQueryFilters,
): WallhavenQueryParamsBase {
  const params: WallhavenQueryParamsBase = {};

  if (filters.categories) {
    params.categories = encodeCategories(filters.categories);
  }

  if (filters.purity) {
    params.purity = encodePurities(filters.purity);
  }

  if (filters.q !== undefined) {
    params.q = filters.q;
  }

  if (filters.page !== undefined) {
    params.page = String(filters.page);
  }

  if (filters.atLeast !== undefined) {
    params.atleast = filters.atLeast;
  }

  if (filters.ratios !== undefined) {
    params.ratios = filters.ratios;
  }

  return params;
}

export function buildWallhavenQueryParams(
  filters: WallhavenQueryFilters,
): WallhavenQueryParams {
  const params = buildWallhavenQueryParamsBase(filters);

  if (filters.sorting === undefined) {
    if (filters.topRange !== undefined) {
      throw new Error("topRange is only supported when sorting is toplist");
    }

    return params;
  }

  const sorting = assertValidSorting(filters.sorting);

  if (sorting === "toplist") {
    if (filters.topRange === undefined) {
      throw new Error("topRange is required when sorting is toplist");
    }

    return {
      ...params,
      sorting,
      topRange: assertValidToplistRange(filters.topRange),
      order: "desc",
    };
  }

  if (filters.topRange !== undefined) {
    throw new Error("topRange is only supported when sorting is toplist");
  }

  return {
    ...params,
    sorting,
  };
}
