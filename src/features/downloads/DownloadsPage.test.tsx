const {
  deleteDownloadTask,
  downloadWallpaper,
  listDownloads,
  loadDownloadDirectory,
  loadSettingsPreferences,
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
  openNativePath,
} = vi.hoisted(() => ({
  deleteDownloadTask: vi.fn(),
  downloadWallpaper: vi.fn(),
  listDownloads: vi.fn(),
  loadDownloadDirectory: vi.fn(),
  loadSettingsPreferences: vi.fn(),
  listenForDownloadProgressEvents: vi.fn(),
  listenForDownloadStatusEvents: vi.fn(),
  openNativePath: vi.fn(),
}))

vi.mock("@/infrastructure/tauri/download-repository", () => ({
  deleteDownloadTask,
  downloadWallpaper,
  listDownloads,
}))

vi.mock("@/infrastructure/tauri/download-events", () => ({
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
}))

vi.mock("@/application/settings/settings-service", () => ({
  loadDownloadDirectory,
  loadSettingsPreferences,
}))

vi.mock("@/infrastructure/tauri/native-shell", () => ({
  openNativePath,
}))

import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { DownloadsPage } from "./DownloadsPage"

const clipboardWriteText = vi.fn()

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })

  return { promise, resolve, reject }
}

describe("DownloadsPage", () => {
  let statusHandler:
    | ((event: {
        payload: {
          taskId: string
          wallpaperId: string
          fileName: string
          relativeFilePath: string
          status: string
          failureReason?: string
        }
      }) => void)
    | undefined
  let progressHandler:
    | ((event: {
        payload: {
          taskId: string
          wallpaperId: string
          fileName: string
          downloadedBytes: number
          totalBytes?: number
        }
      }) => void)
    | undefined

  beforeEach(() => {
    statusHandler = undefined
    progressHandler = undefined
    vi.resetAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText.mockResolvedValue(undefined),
      },
    })
    useUiShellStore.setState({
      downloadSummary: {
        activeCount: 0,
        completedCount: 0,
        failedCount: 0,
      },
      confirm: null,
      toasts: [],
    })
    vi.mocked(loadSettingsPreferences).mockResolvedValue({
      launchAtLogin: false,
      confirmBeforeDelete: true,
      telemetryEnabled: false,
      cacheSizeBytes: 38_400_000,
    })
    vi.mocked(loadDownloadDirectory).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Wallhaven",
      effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
      defaultDirectoryPath: "/Users/test/Pictures/Wallhaven",
      isUsingDefaultDirectory: false,
    })
    vi.mocked(openNativePath).mockResolvedValue(undefined)
    vi.mocked(downloadWallpaper).mockResolvedValue({
      id: "download-retry",
      wallpaperId: "retry123",
      fileName: "retry.jpg",
      relativeFilePath: "wallpapers/retry.jpg",
      status: "queued",
    })
    vi.mocked(deleteDownloadTask).mockResolvedValue(undefined)

    vi.mocked(listenForDownloadStatusEvents).mockImplementation(async (handler) => {
      statusHandler = handler as typeof statusHandler
      return vi.fn()
    })

    vi.mocked(listenForDownloadProgressEvents).mockImplementation(async (handler) => {
      progressHandler = handler as typeof progressHandler
      return vi.fn()
    })
  })

  it("loads existing downloads and updates live task status and progress", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-000001",
        wallpaperId: "kxpkmm",
        fileName: "wallhaven-kxpkmm.jpg",
        relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
        status: "failed",
        failureReason: "503 Service Unavailable",
      },
    ])

    render(<DownloadsPage />)

    expect(await screen.findByText("wallhaven-kxpkmm.jpg")).toBeInTheDocument()
    expect(screen.getByText("wallpapers/wallhaven-kxpkmm.jpg")).toBeInTheDocument()
    expect(screen.getAllByText(/503 Service Unavailable/i).length).toBeGreaterThan(0)

    act(() => {
      statusHandler?.({
        payload: {
          taskId: "download-000002",
          wallpaperId: "ab1234",
          fileName: "wallhaven-ab1234.png",
          relativeFilePath: "wallpapers/wallhaven-ab1234.png",
          status: "running",
        },
      })
    })

    expect(screen.getByText("wallhaven-ab1234.png")).toBeInTheDocument()
    expect(screen.getAllByText(/Downloading/i).length).toBeGreaterThan(0)

    act(() => {
      progressHandler?.({
        payload: {
          taskId: "download-000002",
          wallpaperId: "ab1234",
          fileName: "wallhaven-ab1234.png",
          downloadedBytes: 1024,
          totalBytes: 2048,
        },
      })
    })

    expect(screen.getByText("1 KB / 2 KB")).toBeInTheDocument()

    act(() => {
      statusHandler?.({
        payload: {
          taskId: "download-000002",
          wallpaperId: "ab1234",
          fileName: "wallhaven-ab1234.png",
          relativeFilePath: "wallpapers/wallhaven-ab1234.png",
          status: "succeeded",
        },
      })
    })

    expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0)
  })

  it("renders live events for queue, progress, and completion updates", async () => {
    vi.mocked(listDownloads).mockResolvedValue([])

    render(<DownloadsPage />)

    await screen.findByText(/No downloads yet/i)

    act(() => {
      statusHandler?.({
        payload: {
          taskId: "download-live-events",
          wallpaperId: "queue123",
          fileName: "wallhaven-queue123.jpg",
          relativeFilePath: "wallpapers/wallhaven-queue123.jpg",
          status: "queued",
        },
      })
    })

    act(() => {
      progressHandler?.({
        payload: {
          taskId: "download-live-events",
          wallpaperId: "queue123",
          fileName: "wallhaven-queue123.jpg",
          downloadedBytes: 1024,
          totalBytes: 4096,
        },
      })
    })

    act(() => {
      statusHandler?.({
        payload: {
          taskId: "download-live-events",
          wallpaperId: "queue123",
          fileName: "wallhaven-queue123.jpg",
          relativeFilePath: "wallpapers/wallhaven-queue123.jpg",
          status: "succeeded",
        },
      })
    })

    expect(screen.getByText(/已加入队列 · wallhaven-queue123.jpg/i)).toBeInTheDocument()
    expect(screen.getByText(/下载进度 · wallhaven-queue123.jpg · 25%/i)).toBeInTheDocument()
    expect(screen.getByText(/任务完成 · wallhaven-queue123.jpg/i)).toBeInTheDocument()
  })

  it("filters the queue when switching tabs, including queued-only tasks", async () => {
    const user = userEvent.setup()

    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-queued",
        wallpaperId: "queue123",
        fileName: "wallhaven-queue123.jpg",
        relativeFilePath: "wallpapers/wallhaven-queue123.jpg",
        status: "queued",
      },
      {
        id: "download-running",
        wallpaperId: "run123",
        fileName: "wallhaven-run123.jpg",
        relativeFilePath: "wallpapers/wallhaven-run123.jpg",
        status: "running",
      },
      {
        id: "download-failed",
        wallpaperId: "fail123",
        fileName: "wallhaven-fail123.jpg",
        relativeFilePath: "wallpapers/wallhaven-fail123.jpg",
        status: "failed",
        failureReason: "Connection reset",
      },
    ])

    render(<DownloadsPage />)

    expect(await screen.findByText("wallhaven-queue123.jpg")).toBeInTheDocument()
    expect(screen.getByText("wallhaven-run123.jpg")).toBeInTheDocument()
    expect(screen.getByText("wallhaven-fail123.jpg")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Queued/i }))

    expect(screen.getByText("wallhaven-queue123.jpg")).toBeInTheDocument()
    expect(screen.queryByText("wallhaven-run123.jpg")).not.toBeInTheDocument()
    expect(screen.queryByText("wallhaven-fail123.jpg")).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Failed/i }))

    expect(screen.getByText("wallhaven-fail123.jpg")).toBeInTheDocument()
    expect(screen.queryByText("wallhaven-run123.jpg")).not.toBeInTheDocument()
  })

  it("syncs the aggregated download summary into the shell store", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-running-summary",
        wallpaperId: "run999",
        fileName: "wallhaven-run999.jpg",
        relativeFilePath: "wallpapers/wallhaven-run999.jpg",
        status: "running",
      },
      {
        id: "download-succeeded-summary",
        wallpaperId: "done999",
        fileName: "wallhaven-done999.jpg",
        relativeFilePath: "wallpapers/wallhaven-done999.jpg",
        status: "succeeded",
      },
      {
        id: "download-failed-summary",
        wallpaperId: "fail999",
        fileName: "wallhaven-fail999.jpg",
        relativeFilePath: "wallpapers/wallhaven-fail999.jpg",
        status: "failed",
        failureReason: "timeout",
      },
    ])

    render(<DownloadsPage />)

    await screen.findByText("wallhaven-run999.jpg")

    await waitFor(() => {
      expect(useUiShellStore.getState().downloadSummary).toEqual({
        activeCount: 1,
        completedCount: 1,
        failedCount: 1,
      })
    })
  })

  it("keeps the last aggregated shell summary after the page unmounts", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-queued-summary",
        wallpaperId: "queue999",
        fileName: "wallhaven-queue999.jpg",
        relativeFilePath: "wallpapers/wallhaven-queue999.jpg",
        status: "queued",
      },
      {
        id: "download-skipped-summary",
        wallpaperId: "skip999",
        fileName: "wallhaven-skip999.jpg",
        relativeFilePath: "wallpapers/wallhaven-skip999.jpg",
        status: "skipped_existing",
      },
    ])

    const { unmount } = render(<DownloadsPage />)

    await screen.findByText("wallhaven-queue999.jpg")

    await waitFor(() => {
      expect(useUiShellStore.getState().downloadSummary).toEqual({
        activeCount: 1,
        completedCount: 1,
        failedCount: 0,
      })
    })

    unmount()

    expect(useUiShellStore.getState().downloadSummary).toEqual({
      activeCount: 1,
      completedCount: 1,
      failedCount: 0,
    })
  })

  it("renders an empty state when there are no downloads yet", async () => {
    vi.mocked(listDownloads).mockResolvedValue([])

    render(<DownloadsPage />)

    expect(await screen.findByText(/No downloads yet/i)).toBeInTheDocument()
  })

  it("opens the effective download directory from the command center", async () => {
    vi.mocked(listDownloads).mockResolvedValue([])

    render(<DownloadsPage />)

    const user = userEvent.setup()
    await screen.findByText(/No downloads yet/i)
    await user.click(screen.getByRole("button", { name: /Open folder/i }))

    expect(loadDownloadDirectory).toHaveBeenCalledTimes(1)
    expect(openNativePath).toHaveBeenCalledWith("/Users/test/Pictures/Wallhaven")
  })

  it("opens completed files through the native shell", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-open",
        wallpaperId: "open123",
        sourceUrl: "https://w.wallhaven.cc/full/open123.jpg",
        fileName: "wallhaven-open123.jpg",
        relativeFilePath: "wallpapers/wallhaven-open123.jpg",
        absolutePath: "/Users/test/Pictures/Wallhaven/wallhaven-open123.jpg",
        status: "succeeded",
      },
    ])

    render(<DownloadsPage />)

    const user = userEvent.setup()
    await screen.findByText("wallhaven-open123.jpg")
    await user.click(screen.getByRole("button", { name: /Open file for task download-open/i }))

    expect(openNativePath).toHaveBeenCalledWith("/Users/test/Pictures/Wallhaven/wallhaven-open123.jpg")
  })

  it("copies completed download paths to the clipboard", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-copy",
        wallpaperId: "copy123",
        sourceUrl: "https://w.wallhaven.cc/full/copy123.jpg",
        fileName: "wallhaven-copy123.jpg",
        relativeFilePath: "wallpapers/wallhaven-copy123.jpg",
        absolutePath: "/Users/test/Pictures/Wallhaven/wallhaven-copy123.jpg",
        status: "succeeded",
      },
    ])

    render(<DownloadsPage />)

    const user = userEvent.setup()
    await screen.findByText("wallhaven-copy123.jpg")
    await user.click(screen.getByRole("button", { name: /Copy path for task download-copy/i }))

    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Path copied")
    })
  })

  it("retries failed downloads and deletes terminal tasks through the confirmation dialog", async () => {
    vi.mocked(listDownloads).mockResolvedValue([
      {
        id: "download-failed-action",
        wallpaperId: "fail123",
        sourceUrl: "https://w.wallhaven.cc/full/fail123.jpg",
        fileName: "wallhaven-fail123.jpg",
        relativeFilePath: "wallpapers/wallhaven-fail123.jpg",
        absolutePath: "/Users/test/Pictures/Wallhaven/wallhaven-fail123.jpg",
        status: "failed",
        failureReason: "Connection reset",
        purity: "sfw",
        category: "general",
      },
    ])

    render(
      <>
        <DownloadsPage />
        <ConfirmDialog />
      </>,
    )

    const user = userEvent.setup()
    await screen.findByText("wallhaven-fail123.jpg")
    await user.click(screen.getByRole("button", { name: /Retry task download-failed-action/i }))

    expect(downloadWallpaper).toHaveBeenCalledWith({
      wallpaperId: "fail123",
      imageUrl: "https://w.wallhaven.cc/full/fail123.jpg",
      fileName: "wallhaven-fail123.jpg",
      purity: "sfw",
      category: "general",
    })

    await user.click(screen.getByRole("button", { name: /Delete task download-failed-action/i }))
    expect(screen.getByRole("dialog", { name: /Delete download task/i })).toBeInTheDocument()
    await user.click(
      within(screen.getByRole("dialog", { name: /Delete download task/i })).getByRole("button", { name: /^Delete task$/i }),
    )

    expect(deleteDownloadTask).toHaveBeenCalledWith("download-failed-action")
    await waitFor(() => {
      expect(screen.queryByText("wallhaven-fail123.jpg")).not.toBeInTheDocument()
    })
  })

  it("keeps a newer status event when the loaded snapshot resolves later with stale data", async () => {
    const deferredDownloads = createDeferred<
      Array<{
        id: string
        wallpaperId: string
        fileName: string
        relativeFilePath: string
        status: "queued" | "running" | "succeeded" | "failed" | "skipped_existing"
        failureReason?: string
      }>
    >()
    vi.mocked(listDownloads).mockReturnValue(deferredDownloads.promise)

    render(<DownloadsPage />)

    act(() => {
      statusHandler?.({
        payload: {
          taskId: "download-live",
          wallpaperId: "wh-live",
          fileName: "wallhaven-live.jpg",
          relativeFilePath: "wallpapers/wallhaven-live.jpg",
          status: "succeeded",
        },
      })
    })

    deferredDownloads.resolve([
      {
        id: "download-live",
        wallpaperId: "wh-live",
        fileName: "wallhaven-live.jpg",
        relativeFilePath: "wallpapers/wallhaven-live.jpg",
        status: "running",
      },
    ])

    expect(await screen.findAllByText(/Completed/i)).not.toHaveLength(0)
    expect(screen.queryByText("Connecting...")).not.toBeInTheDocument()
  })
})
