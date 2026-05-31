import type { WallhavenQueryFilters } from "@/domain/wallhaven/models";
import { loadStoredWallhavenKey } from "@/infrastructure/tauri/settings-repository";
import { searchWallpapers as searchWallpapersInRepository } from "@/infrastructure/tauri/search-repository";

export async function searchWallpapers(filters: WallhavenQueryFilters) {
  const wallhavenKey = await loadStoredWallhavenKey().catch(() => "");
  return searchWallpapersInRepository(filters, wallhavenKey);
}
