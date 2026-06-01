import { describe, expect, it } from "vitest";

import { buildWallhavenQueryParams } from "@/domain/wallhaven/query-mappers";

import { buildSearchWallpapersCommandPayload } from "./search-contract";

describe("buildSearchWallpapersCommandPayload", () => {
  it("maps structured filters to the Tauri search command payload instead of HTTP query params", () => {
    const filters = {
      categories: "ga",
      purity: { sfw: true, sketchy: true, nsfw: false },
      sorting: "toplist",
      topRange: "1M",
      q: "landscape",
      page: 2,
      atLeast: "1920x1080",
      ratios: "16x9,16x10",
    } as const;

    const commandPayload = buildSearchWallpapersCommandPayload(filters, {
      apiKey: "test-key",
    });

    expect(commandPayload).toEqual({
      categories: "ga",
      purity: { sfw: true, sketchy: true, nsfw: false },
      sorting: "toplist",
      topRange: "1M",
      q: "landscape",
      page: 2,
      atLeast: "1920x1080",
      ratios: "16x9,16x10",
      apiKey: "test-key",
    });

    expect(commandPayload).not.toEqual(buildWallhavenQueryParams(filters));
    expect(commandPayload).not.toHaveProperty("order");
  });

  it("omits empty api keys and keeps date_added requests free of toplist-only fields", () => {
    expect(
      buildSearchWallpapersCommandPayload(
        {
          categories: "general",
          purity: { sfw: true, sketchy: false, nsfw: false },
          sorting: "date_added",
          q: "space",
          page: 1,
        },
        { apiKey: "   " },
      ),
    ).toEqual({
      categories: "general",
      purity: { sfw: true, sketchy: false, nsfw: false },
      sorting: "date_added",
      q: "space",
      page: 1,
    });
  });

  it("supports minimal free-text payloads without introducing HTTP-only encoding", () => {
    expect(
      buildSearchWallpapersCommandPayload({
        q: "cats",
        page: 3,
      }),
    ).toEqual({
      q: "cats",
      page: 3,
    });
  });
});
