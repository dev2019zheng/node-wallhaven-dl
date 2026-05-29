vi.mock("@/infrastructure/tauri/download-repository", () => ({
  downloadWallpaper: vi.fn(),
  listDownloads: vi.fn(),
}))

import {
  downloadWallpaper as downloadWallpaperInRepository,
  listDownloads as listDownloadsInRepository,
} from "@/infrastructure/tauri/download-repository"

import {
  applyDownloadProgressEvent,
  applyDownloadStatusEvent,
  downloadWallpaper,
  filterDownloads,
  listDownloads,
  mergeLoadedDownloads,
  summarizeDownloads,
} from "./downloads-service"

const sampleTask = {
  id: "download-000001",
  wallpaperId: "kxpkmm",
  fileName: "wallhaven-kxpkmm.jpg",
  relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
  status: "queued" as const,
}

describe("downloads-service", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("loads repository tasks into list items with zeroed progress while keeping repository order", async () => {
    vi.mocked(listDownloadsInRepository).mockResolvedValue([
      {
        ...sampleTask,
        id: "download-a-uuid",
        wallpaperId: "ab1234",
        fileName: "wallhaven-ab1234.png",
        relativeFilePath: "wallpapers/wallhaven-ab1234.png",
        status: "failed",
        failureReason: "503 Service Unavailable",
      },
      {
        ...sampleTask,
        id: "download-z-uuid",
      },
    ])

    await expect(listDownloads()).resolves.toEqual([
      {
        id: "download-a-uuid",
        wallpaperId: "ab1234",
        fileName: "wallhaven-ab1234.png",
        relativeFilePath: "wallpapers/wallhaven-ab1234.png",
        status: "failed",
        failureReason: "503 Service Unavailable",
        downloadedBytes: 0,
      },
      {
        id: "download-z-uuid",
        wallpaperId: "kxpkmm",
        fileName: "wallhaven-kxpkmm.jpg",
        relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
        status: "queued",
        downloadedBytes: 0,
      },
    ])
  })

  it("forwards wallpaper download requests to the repository", async () => {
    vi.mocked(downloadWallpaperInRepository).mockResolvedValue(sampleTask)

    await expect(
      downloadWallpaper({
        wallpaperId: "kxpkmm",
        imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
        fileName: "wallhaven-kxpkmm.jpg",
      }),
    ).resolves.toEqual({
      ...sampleTask,
      downloadedBytes: 0,
    })

    expect(downloadWallpaperInRepository).toHaveBeenCalledWith({
      wallpaperId: "kxpkmm",
      imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      fileName: "wallhaven-kxpkmm.jpg",
    })
  })

  it("merges loaded snapshots without losing live progress and applies status and progress events", () => {
    const runningDownloads = applyDownloadProgressEvent(
      applyDownloadStatusEvent([], {
        taskId: "download-000001",
        wallpaperId: "kxpkmm",
        fileName: "wallhaven-kxpkmm.jpg",
        relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
        status: "running",
      }),
      {
        taskId: "download-000001",
        wallpaperId: "kxpkmm",
        fileName: "wallhaven-kxpkmm.jpg",
        downloadedBytes: 1024,
        totalBytes: 2048,
      },
    )

    expect(runningDownloads[0]).toMatchObject({
      status: "running",
      downloadedBytes: 1024,
      totalBytes: 2048,
    })

    const mergedDownloads = mergeLoadedDownloads(runningDownloads, [
      {
        ...sampleTask,
        status: "running",
      },
    ])

    expect(mergedDownloads[0]).toMatchObject({
      status: "running",
      downloadedBytes: 1024,
      totalBytes: 2048,
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
    })

    const failedDownloads = applyDownloadStatusEvent(mergedDownloads, {
      taskId: "download-000001",
      wallpaperId: "kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      status: "failed",
      failureReason: "disk full",
    })

    expect(failedDownloads[0]).toMatchObject({
      status: "failed",
      failureReason: "disk full",
      downloadedBytes: 1024,
    })
  })

  it("does not let a stale loaded snapshot roll back a newer terminal status", () => {
    const currentDownloads = applyDownloadStatusEvent([], {
      taskId: "download-live",
      wallpaperId: "wh-live",
      fileName: "wallhaven-live.jpg",
      relativeFilePath: "wallpapers/wallhaven-live.jpg",
      status: "succeeded",
    })

    const mergedDownloads = mergeLoadedDownloads(currentDownloads, [
      {
        id: "download-live",
        wallpaperId: "wh-live",
        fileName: "wallhaven-live.jpg",
        relativeFilePath: "wallpapers/wallhaven-live.jpg",
        status: "running",
      },
    ])

    expect(mergedDownloads[0]).toMatchObject({
      id: "download-live",
      status: "succeeded",
    })
  })

  it("keeps existing snapshot order and prepends newly observed live tasks", () => {
    const loadedDownloads = mergeLoadedDownloads([], [
      {
        ...sampleTask,
        id: "download-a-uuid",
        wallpaperId: "a-task",
        fileName: "wallhaven-a-task.jpg",
        relativeFilePath: "wallpapers/wallhaven-a-task.jpg",
        status: "running",
      },
      {
        ...sampleTask,
        id: "download-z-uuid",
        wallpaperId: "z-task",
        fileName: "wallhaven-z-task.jpg",
        relativeFilePath: "wallpapers/wallhaven-z-task.jpg",
        status: "queued",
      },
    ])

    expect(loadedDownloads.map((download) => download.id)).toEqual([
      "download-a-uuid",
      "download-z-uuid",
    ])

    const updatedDownloads = applyDownloadStatusEvent(loadedDownloads, {
      taskId: "download-z-uuid",
      wallpaperId: "z-task",
      fileName: "wallhaven-z-task.jpg",
      relativeFilePath: "wallpapers/wallhaven-z-task.jpg",
      status: "running",
    })

    expect(updatedDownloads.map((download) => download.id)).toEqual([
      "download-a-uuid",
      "download-z-uuid",
    ])

    const downloadsWithNewLiveTask = applyDownloadStatusEvent(updatedDownloads, {
      taskId: "download-m-uuid",
      wallpaperId: "m-task",
      fileName: "wallhaven-m-task.jpg",
      relativeFilePath: "wallpapers/wallhaven-m-task.jpg",
      status: "running",
    })

    expect(downloadsWithNewLiveTask.map((download) => download.id)).toEqual([
      "download-m-uuid",
      "download-a-uuid",
      "download-z-uuid",
    ])
  })

  it("tracks queued and running tasks separately while still treating queued as active", () => {
    const downloads = [
      {
        id: "download-queued",
        wallpaperId: "queued-id",
        fileName: "wallhaven-queued.jpg",
        relativeFilePath: "wallpapers/wallhaven-queued.jpg",
        status: "queued" as const,
        downloadedBytes: 0,
      },
      {
        id: "download-running",
        wallpaperId: "running-id",
        fileName: "wallhaven-running.jpg",
        relativeFilePath: "wallpapers/wallhaven-running.jpg",
        status: "running" as const,
        downloadedBytes: 256,
        totalBytes: 1024,
      },
      {
        id: "download-skipped",
        wallpaperId: "skipped-id",
        fileName: "wallhaven-skipped.jpg",
        relativeFilePath: "wallpapers/wallhaven-skipped.jpg",
        status: "skipped_existing" as const,
        downloadedBytes: 0,
      },
      {
        id: "download-failed",
        wallpaperId: "failed-id",
        fileName: "wallhaven-failed.jpg",
        relativeFilePath: "wallpapers/wallhaven-failed.jpg",
        status: "failed" as const,
        failureReason: "network",
        downloadedBytes: 0,
      },
    ]

    expect(summarizeDownloads(downloads)).toEqual({
      totalCount: 4,
      queuedCount: 1,
      runningCount: 1,
      activeCount: 2,
      completedCount: 1,
      failedCount: 1,
    })

    expect(filterDownloads(downloads, "queued").map((download) => download.id)).toEqual([
      "download-queued",
    ])
    expect(filterDownloads(downloads, "running").map((download) => download.id)).toEqual([
      "download-running",
    ])
    expect(filterDownloads(downloads, "completed").map((download) => download.id)).toEqual([
      "download-skipped",
    ])
  })
})
