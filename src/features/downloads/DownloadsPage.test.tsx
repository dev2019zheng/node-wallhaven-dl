const {
  listDownloads,
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
} = vi.hoisted(() => ({
  listDownloads: vi.fn(),
  listenForDownloadProgressEvents: vi.fn(),
  listenForDownloadStatusEvents: vi.fn(),
}))

vi.mock("@/infrastructure/tauri/download-repository", () => ({
  downloadWallpaper: vi.fn(),
  listDownloads,
}))

vi.mock("@/infrastructure/tauri/download-events", () => ({
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
}))

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { DownloadsPage } from "./DownloadsPage"

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
    useUiShellStore.setState({
      downloadSummary: {
        activeCount: 0,
        completedCount: 0,
        failedCount: 0,
      },
    })

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
    expect(screen.getByText(/503 Service Unavailable/i)).toBeInTheDocument()

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
    expect(screen.getAllByText(/Running/i).length).toBeGreaterThan(0)

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

    expect(screen.getAllByText(/Succeeded/i).length).toBeGreaterThan(0)
  })

  it("filters the queue when switching tabs", async () => {
    const user = userEvent.setup()

    vi.mocked(listDownloads).mockResolvedValue([
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

    expect(await screen.findByText("wallhaven-run123.jpg")).toBeInTheDocument()
    expect(screen.getByText("wallhaven-fail123.jpg")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /failed/i }))

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

    expect(await screen.findAllByText(/Succeeded/i)).not.toHaveLength(0)
    expect(screen.queryByText("Connecting...")).not.toBeInTheDocument()
  })
})
