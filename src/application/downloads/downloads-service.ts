import type {
  DownloadProgressEventPayload,
  DownloadTaskStatusEventPayload,
} from "@/infrastructure/tauri/download-events"
import {
  downloadWallpaper as downloadWallpaperInRepository,
  listDownloads as listDownloadsInRepository,
} from "@/infrastructure/tauri/download-repository"

import type {
  DownloadListItem,
  DownloadRecord,
  DownloadWallpaperInput,
} from "./downloads.types"

export type DownloadQueueFilter = "all" | "queued" | "running" | "completed" | "failed"

export type DownloadsSummary = {
  totalCount: number
  queuedCount: number
  runningCount: number
  activeCount: number
  completedCount: number
  failedCount: number
}

const statusPrecedence: Record<DownloadListItem["status"], number> = {
  queued: 0,
  running: 1,
  succeeded: 2,
  failed: 2,
  skipped_existing: 2,
}

const queuedStatuses = new Set<DownloadListItem["status"]>(["queued"])
const runningStatuses = new Set<DownloadListItem["status"]>(["running"])
const completedStatuses = new Set<DownloadListItem["status"]>([
  "succeeded",
  "skipped_existing",
])

function mergeStatus(
  existing: DownloadListItem | undefined,
  incomingStatus: DownloadListItem["status"],
): DownloadListItem["status"] {
  if (!existing) {
    return incomingStatus
  }

  if (statusPrecedence[existing.status] > statusPrecedence[incomingStatus]) {
    return existing.status
  }

  if (statusPrecedence[existing.status] < statusPrecedence[incomingStatus]) {
    return incomingStatus
  }

  return existing.status
}

function toDownloadListItem(
  record: DownloadRecord | DownloadListItem,
  existing?: DownloadListItem,
): DownloadListItem {
  const status = mergeStatus(existing, record.status)
  const failureReason =
    status === existing?.status ? existing.failureReason : record.failureReason

  return {
    id: record.id,
    wallpaperId: record.wallpaperId,
    fileName: record.fileName,
    relativeFilePath: record.relativeFilePath,
    status,
    failureReason,
    downloadedBytes:
      existing?.downloadedBytes ??
      ("downloadedBytes" in record ? record.downloadedBytes : 0),
    totalBytes:
      existing?.totalBytes ?? ("totalBytes" in record ? record.totalBytes : undefined),
  }
}

function upsertDownload(
  downloads: DownloadListItem[],
  nextDownload: DownloadListItem,
): DownloadListItem[] {
  const existingIndex = downloads.findIndex((download) => download.id === nextDownload.id)

  if (existingIndex === -1) {
    return [nextDownload, ...downloads]
  }

  const nextDownloads = [...downloads]
  nextDownloads[existingIndex] = nextDownload
  return nextDownloads
}

export async function listDownloads(): Promise<DownloadListItem[]> {
  const downloads = await listDownloadsInRepository()
  return downloads.map((download) => toDownloadListItem(download))
}

export async function downloadWallpaper(
  input: DownloadWallpaperInput,
): Promise<DownloadListItem> {
  const download = await downloadWallpaperInRepository(input)
  return toDownloadListItem(download)
}

export function summarizeDownloads(downloads: DownloadListItem[]): DownloadsSummary {
  const summary: DownloadsSummary = {
    totalCount: downloads.length,
    queuedCount: 0,
    runningCount: 0,
    activeCount: 0,
    completedCount: 0,
    failedCount: 0,
  }

  for (const download of downloads) {
    if (queuedStatuses.has(download.status)) {
      summary.queuedCount += 1
      summary.activeCount += 1
      continue
    }

    if (runningStatuses.has(download.status)) {
      summary.runningCount += 1
      summary.activeCount += 1
      continue
    }

    if (completedStatuses.has(download.status)) {
      summary.completedCount += 1
      continue
    }

    if (download.status === "failed") {
      summary.failedCount += 1
    }
  }

  return summary
}

export function filterDownloads(
  downloads: DownloadListItem[],
  filter: DownloadQueueFilter,
): DownloadListItem[] {
  switch (filter) {
    case "all":
      return downloads
    case "queued":
      return downloads.filter((download) => queuedStatuses.has(download.status))
    case "running":
      return downloads.filter((download) => runningStatuses.has(download.status))
    case "completed":
      return downloads.filter((download) => completedStatuses.has(download.status))
    case "failed":
      return downloads.filter((download) => download.status === "failed")
  }
}

export function mergeLoadedDownloads(
  currentDownloads: DownloadListItem[],
  loadedDownloads: Array<DownloadRecord | DownloadListItem>,
): DownloadListItem[] {
  const nextDownloads = [...currentDownloads]
  const downloadIndexById = new Map(
    nextDownloads.map((download, index) => [download.id, index]),
  )

  for (const loadedDownload of loadedDownloads) {
    const existingIndex = downloadIndexById.get(loadedDownload.id)
    const existingDownload =
      existingIndex === undefined ? undefined : nextDownloads[existingIndex]
    const nextDownload = toDownloadListItem(loadedDownload, existingDownload)

    if (existingIndex === undefined) {
      downloadIndexById.set(loadedDownload.id, nextDownloads.length)
      nextDownloads.push(nextDownload)
      continue
    }

    nextDownloads[existingIndex] = nextDownload
  }

  return nextDownloads
}

export function applyDownloadStatusEvent(
  currentDownloads: DownloadListItem[],
  event: DownloadTaskStatusEventPayload,
): DownloadListItem[] {
  const currentDownload = currentDownloads.find(
    (download) => download.id === event.taskId,
  )

  return upsertDownload(currentDownloads, {
    id: event.taskId,
    wallpaperId: event.wallpaperId,
    fileName: event.fileName,
    relativeFilePath:
      event.relativeFilePath || currentDownload?.relativeFilePath || "",
    status: event.status,
    failureReason: event.failureReason,
    downloadedBytes: currentDownload?.downloadedBytes ?? 0,
    totalBytes: currentDownload?.totalBytes,
  })
}

export function applyDownloadProgressEvent(
  currentDownloads: DownloadListItem[],
  event: DownloadProgressEventPayload,
): DownloadListItem[] {
  const currentDownload = currentDownloads.find(
    (download) => download.id === event.taskId,
  )

  return upsertDownload(currentDownloads, {
    id: event.taskId,
    wallpaperId: event.wallpaperId,
    fileName: event.fileName,
    relativeFilePath: currentDownload?.relativeFilePath ?? "",
    status: currentDownload?.status ?? "running",
    failureReason: currentDownload?.failureReason,
    downloadedBytes: event.downloadedBytes,
    totalBytes: event.totalBytes ?? currentDownload?.totalBytes,
  })
}
