vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

import { invoke } from "@tauri-apps/api/core"

import { downloadWallpaper, listDownloads } from "./download-repository"

const sampleTask = {
  id: "download-000001",
  wallpaperId: "kxpkmm",
  sourceUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
  strategy: {
    baseDir: "appLocalData",
    relativePath: "wallpapers",
  },
  target: {
    fileName: "wallhaven-kxpkmm.jpg",
    relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
  },
  status: "succeeded" as const,
}

describe("download-repository", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("invokes download and list commands and flattens Rust task payloads", async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(sampleTask)
      .mockResolvedValueOnce([sampleTask])

    await expect(
      downloadWallpaper({
        wallpaperId: "kxpkmm",
        imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
        fileName: "wallhaven-kxpkmm.jpg",
      }),
    ).resolves.toEqual({
      id: "download-000001",
      wallpaperId: "kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      status: "succeeded",
    })

    await expect(listDownloads()).resolves.toEqual([
      {
        id: "download-000001",
        wallpaperId: "kxpkmm",
        fileName: "wallhaven-kxpkmm.jpg",
        relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
        status: "succeeded",
      },
    ])

    expect(invoke).toHaveBeenNthCalledWith(1, "download_wallpaper", {
      request: {
        wallpaperId: "kxpkmm",
        imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
        fileName: "wallhaven-kxpkmm.jpg",
      },
    })
    expect(invoke).toHaveBeenNthCalledWith(2, "list_downloads")
  })

  it("maps structured Tauri failures to a download command error", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "network",
      message: "503 Service Unavailable",
    })

    await expect(
      downloadWallpaper({
        wallpaperId: "kxpkmm",
        imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
        fileName: "wallhaven-kxpkmm.jpg",
      }),
    ).rejects.toMatchObject({
      name: "DownloadCommandError",
      kind: "network",
      message: "503 Service Unavailable",
    })
  })

  it("preserves structured conflict failures as a typed download command error", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "conflict",
      message:
        "relative file path wallpapers/shared.jpg is already reserved by wallpaper wh-running; cannot assign it to wh-conflict",
    })

    await expect(
      downloadWallpaper({
        wallpaperId: "wh-conflict",
        imageUrl: "https://w.wallhaven.cc/full/shared/wallhaven-shared.jpg",
        fileName: "shared.jpg",
      }),
    ).rejects.toMatchObject({
      name: "DownloadCommandError",
      kind: "conflict",
      message:
        "relative file path wallpapers/shared.jpg is already reserved by wallpaper wh-running; cannot assign it to wh-conflict",
    })
  })
})
