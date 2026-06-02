import type { SearchWallpapersResponse } from "@/application/search/search.types";
import type {
  WallhavenCategoryFilter,
  WallhavenQueryFilters,
  WallhavenToplistRange,
} from "@/domain/wallhaven/models";

export type SearchPageFormValues = {
  category: WallhavenCategoryFilter;
  purityPreset: "sfw" | "sketchy" | "nsfw" | "ws" | "wn" | "sn" | "all";
  sorting: "date_added" | "toplist";
  topRange: WallhavenToplistRange;
  resolution: "all" | "1920x1080" | "2560x1440" | "3840x2160";
  aspectRatio: "all" | "16x9" | "16x10" | "21x9" | "4x3" | "portrait";
  q: string;
  page: number;
  pagesToDownload: number;
};

export type SearchPageSessionSnapshot = {
  formValues: SearchPageFormValues;
  submittedFormValues: SearchPageFormValues | null;
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
