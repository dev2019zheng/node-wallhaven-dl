export type DownloadTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped_existing"

export type DownloadRecord = {
  id: string
  wallpaperId: string
  fileName: string
  relativeFilePath: string
  status: DownloadTaskStatus
  failureReason?: string
}

export type DownloadListItem = DownloadRecord & {
  downloadedBytes: number
  totalBytes?: number
}

export type DownloadWallpaperInput = {
  wallpaperId: string
  imageUrl: string
  fileName: string
}

export type DownloadCommandErrorKind =
  | "invalidRequest"
  | "resolvePath"
  | "network"
  | "io"
  | "conflict"
  | "internal"

export type DownloadCommandErrorPayload = {
  kind: DownloadCommandErrorKind
  message: string
}

export class DownloadCommandError extends Error {
  kind: DownloadCommandErrorKind

  constructor({ kind, message }: DownloadCommandErrorPayload) {
    super(message)
    this.name = "DownloadCommandError"
    this.kind = kind
  }
}

export function isDownloadCommandErrorPayload(
  error: unknown,
): error is DownloadCommandErrorPayload {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as Partial<DownloadCommandErrorPayload>
  return typeof candidate.kind === "string" && typeof candidate.message === "string"
}

export function toDownloadCommandError(error: unknown): DownloadCommandError {
  if (isDownloadCommandErrorPayload(error)) {
    return new DownloadCommandError(error)
  }

  if (error instanceof Error) {
    return new DownloadCommandError({
      kind: "internal",
      message: error.message,
    })
  }

  return new DownloadCommandError({
    kind: "internal",
    message: "Unexpected download command failure.",
  })
}
