import { describe, expect, it } from "vitest";

import { buildWallhavenQueryParams } from "@/domain/wallhaven/query-mappers";

describe("buildWallhavenQueryParams", () => {
  it("builds toplist query params from structured filters", () => {
    expect(
      buildWallhavenQueryParams({
        categories: "ga",
        purity: { sfw: true, sketchy: true, nsfw: false },
        sorting: "toplist",
        topRange: "1M",
        q: "landscape",
        page: 2,
        atLeast: "1920x1080",
        ratios: "16x9,16x10",
      }),
    ).toEqual({
      categories: "110",
      purity: "110",
      sorting: "toplist",
      topRange: "1M",
      order: "desc",
      q: "landscape",
      page: "2",
      atleast: "1920x1080",
      ratios: "16x9,16x10",
    });
  });

  it("builds date_added query params without toplist-only fields", () => {
    expect(
      buildWallhavenQueryParams({
        categories: "general",
        purity: { sfw: true, sketchy: false, nsfw: false },
        sorting: "date_added",
        q: "space",
        page: 1,
      }),
    ).toEqual({
      categories: "100",
      purity: "100",
      sorting: "date_added",
      q: "space",
      page: "1",
    });
  });

  it("supports minimal free-text search params", () => {
    expect(
      buildWallhavenQueryParams({
        q: "cats",
        page: 3,
      }),
    ).toEqual({
      q: "cats",
      page: "3",
    });
  });

  it("throws when toplist is missing a required range", () => {
    expect(() =>
      buildWallhavenQueryParams({
        sorting: "toplist",
      } as never),
    ).toThrowError(/toprange.*required.*toplist/i);
  });

  it("throws when non-toplist sorting receives a toplist range", () => {
    expect(() =>
      buildWallhavenQueryParams({
        sorting: "date_added",
        topRange: "1w",
      } as never),
    ).toThrowError(/toprange.*only supported.*toplist/i);
  });

  it("throws when sorting receives an unsupported value", () => {
    expect(() =>
      buildWallhavenQueryParams({
        sorting: "favorites",
      } as never),
    ).toThrowError(/invalid sorting/i);
  });

  it("throws when toplist receives an unsupported range", () => {
    expect(() =>
      buildWallhavenQueryParams({
        sorting: "toplist",
        topRange: "2w",
      } as never),
    ).toThrowError(/invalid toplist range/i);
  });
});
