vi.mock("@/infrastructure/tauri/settings-repository", () => ({
  loadStoredWallhavenKey: vi.fn(),
}));

vi.mock("@/infrastructure/tauri/search-repository", () => ({
  searchWallpapers: vi.fn(),
}));

import type { SearchWallpapersResponse } from "./search.types";
import { loadStoredWallhavenKey } from "@/infrastructure/tauri/settings-repository";
import { searchWallpapers as searchWallpapersInRepository } from "@/infrastructure/tauri/search-repository";

import { searchWallpapers } from "./search-service";

const sampleFilters = {
  categories: "ga",
  purity: { sfw: true, sketchy: true, nsfw: false },
  sorting: "toplist",
  topRange: "1M",
  q: "landscape",
  page: 2,
} as const;

const sampleResult: SearchWallpapersResponse = {
  data: [
    {
      id: "kxpkmm",
      url: "https://wallhaven.cc/w/kxpkmm",
      shortUrl: "https://whvn.cc/kxpkmm",
      views: 2572,
      favorites: 79,
      source: "https://x.com/sciamano240/status/1870129953464815847",
      purity: "sfw",
      category: "anime",
      dimensionX: 1966,
      dimensionY: 3000,
      resolution: "1966x3000",
      ratio: "0.66",
      fileSize: 3088002,
      fileType: "image/jpeg",
      createdAt: "2025-01-31 00:21:26",
      colors: ["#cccccc"],
      path: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      thumbs: {
        large: "https://th.wallhaven.cc/lg/kx/kxpkmm.jpg",
        original: "https://th.wallhaven.cc/orig/kx/kxpkmm.jpg",
        small: "https://th.wallhaven.cc/small/kx/kxpkmm.jpg",
      },
    },
  ],
  meta: {
    currentPage: 1,
    lastPage: 9,
    perPage: "24",
    total: 210,
    query: "landscape",
    seed: null,
  },
};

describe("search-service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the stored Wallhaven key and forwards structured filters to the search repository", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(searchWallpapersInRepository).mockResolvedValue(sampleResult);

    await expect(searchWallpapers(sampleFilters)).resolves.toEqual(sampleResult);

    expect(loadStoredWallhavenKey).toHaveBeenCalledTimes(1);
    expect(searchWallpapersInRepository).toHaveBeenCalledWith(sampleFilters, "stored-key");
  });

  it("keeps search working when no key is stored", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("");
    vi.mocked(searchWallpapersInRepository).mockResolvedValue(sampleResult);

    await searchWallpapers({ q: "cats", page: 3 });

    expect(searchWallpapersInRepository).toHaveBeenCalledWith({ q: "cats", page: 3 }, "");
  });

  it("keeps search working when key storage is unavailable", async () => {
    vi.mocked(loadStoredWallhavenKey).mockRejectedValue(new Error("store unavailable"));
    vi.mocked(searchWallpapersInRepository).mockResolvedValue(sampleResult);

    await searchWallpapers({ q: "mountains", page: 1 });

    expect(searchWallpapersInRepository).toHaveBeenCalledWith({ q: "mountains", page: 1 }, "");
  });
});
