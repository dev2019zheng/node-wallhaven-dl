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

import { act, render, screen } from "@testing-library/react"

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
    expect(screen.queryByText(/^Running$/)).not.toBeInTheDocument()
  })
})
