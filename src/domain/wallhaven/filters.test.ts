import { describe, expect, it } from "vitest";

import {
  LEGACY_CATEGORY_CODES,
  LEGACY_PURITY_CODES,
  VALID_TOPLIST_RANGES,
  type WallhavenCategoryCode,
  type WallhavenCategoryFilter,
} from "@/domain/wallhaven/models";
import {
  assertValidToplistRange,
  encodeCategories,
  encodePurities,
  isValidToplistRange,
} from "@/domain/wallhaven/filters";

const CATEGORY_CASES = [
  ["all", LEGACY_CATEGORY_CODES.all],
  ["general", LEGACY_CATEGORY_CODES.general],
  ["anime", LEGACY_CATEGORY_CODES.anime],
  ["people", LEGACY_CATEGORY_CODES.people],
  ["ga", LEGACY_CATEGORY_CODES.ga],
  ["gp", LEGACY_CATEGORY_CODES.gp],
] as const satisfies readonly (readonly [WallhavenCategoryFilter, WallhavenCategoryCode])[];

describe("encodeCategories", () => {
  it.each(CATEGORY_CASES)("maps %s to %s", (input, expected) => {
    expect(encodeCategories(input)).toBe(expected);
  });

  it("rejects unsupported legacy category presets at runtime", () => {
    expect(() => encodeCategories("ap" as never)).toThrowError(/invalid category/i);
  });
});

describe("encodePurities", () => {
  it.each([
    [{ sfw: true, sketchy: false, nsfw: false }, LEGACY_PURITY_CODES.sfw],
    [{ sfw: false, sketchy: true, nsfw: false }, LEGACY_PURITY_CODES.sketchy],
    [{ sfw: false, sketchy: false, nsfw: true }, LEGACY_PURITY_CODES.nsfw],
    [{ sfw: true, sketchy: true, nsfw: false }, LEGACY_PURITY_CODES.ws],
    [{ sfw: true, sketchy: false, nsfw: true }, LEGACY_PURITY_CODES.wn],
    [{ sfw: false, sketchy: true, nsfw: true }, LEGACY_PURITY_CODES.sn],
    [{ sfw: true, sketchy: true, nsfw: true }, LEGACY_PURITY_CODES.all],
  ])("maps %o to %s", (input, expected) => {
    expect(encodePurities(input)).toBe(expected);
  });

  it("rejects an empty purity selection", () => {
    expect(() =>
      encodePurities({ sfw: false, sketchy: false, nsfw: false }),
    ).toThrowError(/at least one purity/i);
  });
});

describe("toplist range validation", () => {
  it("keeps the legacy supported toplist ranges", () => {
    expect(VALID_TOPLIST_RANGES).toEqual(["1d", "3d", "1w", "1M", "3M", "6M", "1y"]);
  });

  it.each(VALID_TOPLIST_RANGES)("accepts %s", (range) => {
    expect(isValidToplistRange(range)).toBe(true);
    expect(assertValidToplistRange(range)).toBe(range);
  });

  it.each(["", "7d", "2w", "12h", "2M"])("rejects %s", (range) => {
    expect(isValidToplistRange(range)).toBe(false);
    expect(() => assertValidToplistRange(range)).toThrowError(/invalid toplist range/i);
  });
});
