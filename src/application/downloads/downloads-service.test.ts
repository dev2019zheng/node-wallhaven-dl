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
  listDownloads,
  mergeLoadedDownloads,
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

  it("loads repository tasks into sortable list items with zeroed progress", async () => {
    vi.mocked(listDownloadsInRepository).mockResolvedValue([
      sampleTask,
      {
        ...sampleTask,
        id: "download-000010",
        wallpaperId: "ab1234",
        fileName: "wallhaven-ab1234.png",
        relativeFilePath: "wallpapers/wallhaven-ab1234.png",
        status: "failed",
        failureReason: "503 Service Unavailable",
      },
    ])

    await expect(listDownloads()).resolves.toEqual([
      {
        id: "download-000010",
        wallpaperId: "ab1234",
        fileName: "wallhaven-ab1234.png",
        relativeFilePath: "wallpapers/wallhaven-ab1234.png",
        status: "failed",
        failureReason: "503 Service Unavailable",
        downloadedBytes: 0,
      },
      {
        id: "download-000001",
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
})
