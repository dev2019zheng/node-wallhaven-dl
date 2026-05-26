import { invoke } from "@tauri-apps/api/core";

import type { SearchWallpapersResponse, SearchCommandError } from "@/application/search/search.types";
import { toSearchCommandError } from "@/application/search/search.types";
import type { WallhavenQueryFilters } from "@/domain/wallhaven/models";

import { buildSearchWallpapersCommandPayload } from "./search-contract";

export async function searchWallpapers(
  filters: WallhavenQueryFilters,
  apiKey?: string,
): Promise<SearchWallpapersResponse> {
  try {
    return await invoke<SearchWallpapersResponse>("search_wallpapers", {
      request: buildSearchWallpapersCommandPayload(filters, { apiKey }),
    });
  } catch (error) {
    throw toSearchCommandError(error) as SearchCommandError;
  }
}
