import type { SearchWallpapersCommandPayload } from "./search-contract";

export const validToplistCommandPayload: SearchWallpapersCommandPayload = {
  categories: "ga",
  purity: { sfw: true, sketchy: true, nsfw: false },
  sorting: "toplist",
  topRange: "1M",
  q: "landscape",
  page: 2,
  apiKey: "test-key",
};

export const validDateAddedCommandPayload: SearchWallpapersCommandPayload = {
  categories: "general",
  sorting: "date_added",
  page: 1,
};

// @ts-expect-error command payload keeps structured categories instead of legacy codes
export const invalidLegacyCategoryCode: SearchWallpapersCommandPayload = { categories: "110" };

// @ts-expect-error command payload keeps page as a number
export const invalidStringPage: SearchWallpapersCommandPayload = { page: "2" };

// @ts-expect-error non-toplist payload cannot include a toplist range
export const invalidNonToplistRange: SearchWallpapersCommandPayload = { sorting: "date_added", topRange: "1M" };

// @ts-expect-error toplist payload still requires topRange
export const invalidToplistWithoutRange: SearchWallpapersCommandPayload = { sorting: "toplist" };
