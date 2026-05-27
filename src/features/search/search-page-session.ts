import type { SearchWallpapersResponse } from "@/application/search/search.types";
import type {
  WallhavenCategoryFilter,
  WallhavenQueryFilters,
  WallhavenToplistRange,
} from "@/domain/wallhaven/models";

type SearchPageSessionFormValues = {
  category: WallhavenCategoryFilter;
  purityPreset: "sfw" | "sketchy" | "nsfw" | "ws" | "wn" | "sn" | "all";
  sorting: "date_added" | "toplist";
  topRange: WallhavenToplistRange;
  q: string;
  page: number;
  pagesToDownload: number;
};

type SearchPageSessionSnapshot = {
  formValues: SearchPageSessionFormValues;
  result: SearchWallpapersResponse | null;
  searchError: string | null;
  activeFilters: WallhavenQueryFilters | null;
};

let searchPageSessionSnapshot: SearchPageSessionSnapshot | null = null;

export function getSearchPageSessionSnapshot(): SearchPageSessionSnapshot | null {
  return searchPageSessionSnapshot;
}

export function saveSearchPageSessionSnapshot(snapshot: SearchPageSessionSnapshot): void {
  searchPageSessionSnapshot = snapshot;
}

export function clearSearchPageSessionSnapshot(): void {
  searchPageSessionSnapshot = null;
}
