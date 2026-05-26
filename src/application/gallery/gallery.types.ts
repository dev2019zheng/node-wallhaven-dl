export type GalleryListRequest = {
  page: number
  pageSize: number
}

export type GalleryItem = {
  wallpaperId: string
  sourceUrl: string
  fileName: string
  relativeFilePath: string
  absolutePath: string
  createdAt: string
}

export type GalleryListResponse = {
  items: GalleryItem[]
  page: number
  pageSize: number
  total: number
}

export type GalleryCommandErrorKind = "invalidRequest" | "internal"

export type GalleryCommandErrorPayload = {
  kind: GalleryCommandErrorKind
  message: string
}

export class GalleryCommandError extends Error {
  kind: GalleryCommandErrorKind

  constructor({ kind, message }: GalleryCommandErrorPayload) {
    super(message)
    this.name = "GalleryCommandError"
    this.kind = kind
  }
}

export function isGalleryCommandErrorPayload(
  error: unknown,
): error is GalleryCommandErrorPayload {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as Partial<GalleryCommandErrorPayload>
  return typeof candidate.kind === "string" && typeof candidate.message === "string"
}

export function toGalleryCommandError(error: unknown): GalleryCommandError {
  if (isGalleryCommandErrorPayload(error)) {
    return new GalleryCommandError(error)
  }

  if (error instanceof Error) {
    return new GalleryCommandError({
      kind: "internal",
      message: error.message,
    })
  }

  return new GalleryCommandError({
    kind: "internal",
    message: "Unexpected gallery command failure.",
  })
}
