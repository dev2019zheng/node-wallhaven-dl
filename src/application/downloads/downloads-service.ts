import type { DownloadProgressEventPayload, DownloadTaskStatusEventPayload } from "@/infrastructure/tauri/download-events"
import {
  downloadWallpaper as downloadWallpaperInRepository,
  listDownloads as listDownloadsInRepository,
} from "@/infrastructure/tauri/download-repository"

import type {
  DownloadListItem,
  DownloadRecord,
  DownloadWallpaperInput,
} from "./downloads.types"

const statusPrecedence: Record<DownloadListItem["status"], number> = {
  queued: 0,
  running: 1,
  succeeded: 2,
  failed: 2,
  skipped_existing: 2,
}

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

function sortDownloads(downloads: DownloadListItem[]): DownloadListItem[] {
  return [...downloads].sort((left, right) => right.id.localeCompare(left.id))
}

function upsertDownload(
  downloads: DownloadListItem[],
  nextDownload: DownloadListItem,
): DownloadListItem[] {
  const downloadsById = new Map(downloads.map((download) => [download.id, download]))
  downloadsById.set(nextDownload.id, nextDownload)
  return sortDownloads([...downloadsById.values()])
}

export async function listDownloads(): Promise<DownloadListItem[]> {
  const downloads = await listDownloadsInRepository()
  return sortDownloads(downloads.map((download) => toDownloadListItem(download)))
}

export async function downloadWallpaper(
  input: DownloadWallpaperInput,
): Promise<DownloadListItem> {
  const download = await downloadWallpaperInRepository(input)
  return toDownloadListItem(download)
}

export function mergeLoadedDownloads(
  currentDownloads: DownloadListItem[],
  loadedDownloads: Array<DownloadRecord | DownloadListItem>,
): DownloadListItem[] {
  const downloadsById = new Map(
    currentDownloads.map((download) => [download.id, download]),
  )

  for (const loadedDownload of loadedDownloads) {
    downloadsById.set(
      loadedDownload.id,
      toDownloadListItem(loadedDownload, downloadsById.get(loadedDownload.id)),
    )
  }

  return sortDownloads([...downloadsById.values()])
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
