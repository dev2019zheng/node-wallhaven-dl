vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

import {
  SearchCommandError,
  type SearchWallpapersResponse,
} from "@/application/search/search.types";

import { searchWallpapers } from "./search-repository";

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

describe("search-repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("invokes search_wallpapers with a structured Tauri request payload", async () => {
    vi.mocked(invoke).mockResolvedValue(sampleResult);

    await expect(searchWallpapers(sampleFilters, "  stored-key  ")).resolves.toEqual(sampleResult);

    expect(invoke).toHaveBeenCalledWith("search_wallpapers", {
      request: {
        categories: "ga",
        purity: { sfw: true, sketchy: true, nsfw: false },
        sorting: "toplist",
        topRange: "1M",
        q: "landscape",
        page: 2,
        apiKey: "stored-key",
      },
    });
  });

  it("maps structured tauri command failures to SearchCommandError", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "upstreamStatus",
      message: "503 Service Unavailable",
      statusCode: 503,
    });

    await expect(searchWallpapers({ q: "cats", page: 3 }, "")).rejects.toEqual(
      new SearchCommandError({
        kind: "upstreamStatus",
        message: "503 Service Unavailable",
        statusCode: 503,
      }),
    );
  });
});
