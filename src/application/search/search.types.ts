export type SearchWallpaperPurity = "sfw" | "sketchy" | "nsfw";
export type SearchWallpaperCategory = "general" | "anime" | "people";

export type SearchWallpaperThumbs = {
  large: string;
  original: string;
  small: string;
};

export type SearchWallpaper = {
  id: string;
  url: string;
  shortUrl: string;
  views: number;
  favorites: number;
  source: string;
  purity: SearchWallpaperPurity;
  category: SearchWallpaperCategory;
  dimensionX: number;
  dimensionY: number;
  resolution: string;
  ratio: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  colors: string[];
  path: string;
  thumbs: SearchWallpaperThumbs;
};

export type SearchWallpapersMeta = {
  currentPage: number;
  lastPage: number;
  perPage: string;
  total: number;
  query: string | null;
  seed: string | null;
};

export type SearchWallpapersResponse = {
  data: SearchWallpaper[];
  meta: SearchWallpapersMeta;
};

export type SearchCommandErrorKind =
  | "invalidRequest"
  | "upstreamStatus"
  | "timeout"
  | "network"
  | "decode"
  | "internal";

export type SearchCommandErrorPayload = {
  kind: SearchCommandErrorKind;
  message: string;
  statusCode?: number;
};

export class SearchCommandError extends Error {
  kind: SearchCommandErrorKind;
  statusCode?: number;

  constructor({ kind, message, statusCode }: SearchCommandErrorPayload) {
    super(message);
    this.name = "SearchCommandError";
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export function isSearchCommandErrorPayload(
  error: unknown,
): error is SearchCommandErrorPayload {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<SearchCommandErrorPayload>;
  return (
    typeof candidate.kind === "string" &&
    typeof candidate.message === "string" &&
    (candidate.statusCode === undefined || typeof candidate.statusCode === "number")
  );
}

export function toSearchCommandError(error: unknown): SearchCommandError {
  if (isSearchCommandErrorPayload(error)) {
    return new SearchCommandError(error);
  }

  if (error instanceof Error) {
    return new SearchCommandError({
      kind: "internal",
      message: error.message,
    });
  }

  return new SearchCommandError({
    kind: "internal",
    message: "Unexpected search command failure.",
  });
}
