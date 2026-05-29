const { downloadWallpaper } = vi.hoisted(() => ({
  downloadWallpaper: vi.fn(),
}))

vi.mock("@/application/downloads/downloads-service", () => ({
  downloadWallpaper,
}))

vi.mock("@/application/search/search-service", () => ({
  searchWallpapers: vi.fn(),
}))

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { searchWallpapers } from "@/application/search/search-service"
import type { SearchWallpaper, SearchWallpapersResponse } from "@/application/search/search.types"

import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { SearchPage } from "./SearchPage"
import { clearSearchPageSessionSnapshot } from "./search-page-session"

function createWallpaper(id: string, overrides: Partial<SearchWallpaper> = {}): SearchWallpaper {
  return {
    id,
    url: `https://wallhaven.cc/w/${id}`,
    shortUrl: `https://whvn.cc/${id}`,
    views: 2572,
    favorites: 79,
    source: "https://x.com/sciamano240/status/1870129953464815847",
    purity: "sfw",
    category: "anime",
    dimensionX: 1966,
    dimensionY: 3000,
    resolution: "1966x3000",
    ratio: "0.66",
    fileSize: 3088002,
    fileType: "image/jpeg",
    createdAt: "2025-01-31 00:21:26",
    colors: ["#cccccc"],
    path: `https://w.wallhaven.cc/full/${id.slice(0, 2)}/wallhaven-${id}.jpg`,
    thumbs: {
      large: `https://th.wallhaven.cc/lg/${id.slice(0, 2)}/${id}.jpg`,
      original: `https://th.wallhaven.cc/orig/${id.slice(0, 2)}/${id}.jpg`,
      small: `https://th.wallhaven.cc/small/${id.slice(0, 2)}/${id}.jpg`,
    },
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function createDownloadResult(wallpaper: SearchWallpaper) {
  const pathSegments = wallpaper.path.split("/")
  const fileName = pathSegments[pathSegments.length - 1] ?? `wallhaven-${wallpaper.id}.jpg`

  return {
    id: `download-${wallpaper.id}`,
    wallpaperId: wallpaper.id,
    fileName,
    relativeFilePath: `wallpapers/${fileName}`,
    status: "succeeded" as const,
  }
}

const sampleResponse: SearchWallpapersResponse = {
  data: [createWallpaper("kxpkmm")],
  meta: {
    currentPage: 1,
    lastPage: 9,
    perPage: "24",
    total: 210,
    query: "aurora",
    seed: null,
  },
}

const secondPageResponse: SearchWallpapersResponse = {
  data: [
    createWallpaper("213edy", {
      dimensionX: 3640,
      dimensionY: 2048,
      resolution: "3640x2048",
      ratio: "1.78",
      path: "https://w.wallhaven.cc/full/21/wallhaven-213edy.png",
      fileType: "image/png",
    }),
  ],
  meta: {
    currentPage: 2,
    lastPage: 9,
    perPage: "24",
    total: 210,
    query: "aurora",
    seed: null,
  },
}

const multiWallpaperResponse: SearchWallpapersResponse = {
  data: [
    createWallpaper("kxpkmm"),
    createWallpaper("zz9xwy", {
      path: "https://w.wallhaven.cc/full/zz/wallhaven-zz9xwy.jpg",
      thumbs: {
        large: "https://th.wallhaven.cc/lg/zz/zz9xwy.jpg",
        original: "https://th.wallhaven.cc/orig/zz/zz9xwy.jpg",
        small: "https://th.wallhaven.cc/small/zz/zz9xwy.jpg",
      },
    }),
  ],
  meta: {
    currentPage: 1,
    lastPage: 1,
    perPage: "24",
    total: 2,
    query: "aurora",
    seed: null,
  },
}

const multiChunkResponse: SearchWallpapersResponse = {
  data: [
    createWallpaper("aa11aa"),
    createWallpaper("bb22bb"),
    createWallpaper("cc33cc"),
    createWallpaper("dd44dd"),
    createWallpaper("ee55ee"),
  ],
  meta: {
    currentPage: 1,
    lastPage: 1,
    perPage: "24",
    total: 5,
    query: "aurora",
    seed: null,
  },
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearSearchPageSessionSnapshot()
    useUiShellStore.setState({ selectedSearchIds: [] })
  })

  it("reveals toplist controls and submits structured filters", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse)

    render(<SearchPage />)

    expect(screen.queryByLabelText(/Toplist range/i)).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText(/Sorting/i), "toplist")
    await user.selectOptions(screen.getByLabelText(/Category/i), "ga")
    await user.selectOptions(screen.getByLabelText(/Purity/i), "ws")
    await user.type(screen.getByLabelText(/Query/i), "aurora")

    const pageInput = screen.getByLabelText(/^Page$/i)
    await user.clear(pageInput)
    await user.type(pageInput, "2")

    expect(screen.getByLabelText(/Toplist range/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    await waitFor(() => {
      expect(searchWallpapers).toHaveBeenCalledWith({
        categories: "ga",
        purity: { sfw: true, sketchy: true, nsfw: false },
        sorting: "toplist",
        topRange: "1M",
        q: "aurora",
        page: 2,
      })
    })

    expect(await screen.findByText(/Loaded 1 wallpaper/i)).toBeInTheDocument()
  })

  it("renders dedicated filters and results regions with wallpaper metadata after a successful search", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse)

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(
      await screen.findByRole("region", { name: /search filters/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: /search results/i })).toBeInTheDocument()
    expect(screen.getByText("1966x3000")).toBeInTheDocument()
    expect(screen.getByText("0.66")).toBeInTheDocument()
  })

  it("renders an empty state when search returns no results", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue({
      data: [],
      meta: {
        currentPage: 1,
        lastPage: 0,
        perPage: "24",
        total: 0,
        query: "cats",
        seed: null,
      },
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByText(/No wallpapers matched the current filters/i)).toBeInTheDocument()
  })

  it("shows search failure feedback", async () => {
    vi.mocked(searchWallpapers).mockRejectedValue(new Error("503 Service Unavailable"))

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("503 Service Unavailable")
  })

  it("starts a wallpaper download from a search result card and disables the button while the request is running", async () => {
    let resolveDownload: ((value: unknown) => void) | undefined

    vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse)
    downloadWallpaper.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve
        }),
    )

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    const downloadButton = await screen.findByRole("button", {
      name: /Download wallpaper kxpkmm/i,
    })

    await user.click(downloadButton)

    expect(downloadWallpaper).toHaveBeenCalledWith({
      wallpaperId: "kxpkmm",
      imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      fileName: "wallhaven-kxpkmm.jpg",
    })
    expect(screen.getByText(/Open Downloads to monitor live progress/i)).toBeInTheDocument()
    expect(downloadButton).toBeDisabled()

    resolveDownload?.({
      id: "download-000001",
      wallpaperId: "kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      status: "succeeded",
    })

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled()
    })
  })

  it("downloads the current query across the requested page range with one click", async () => {
    vi.mocked(searchWallpapers)
      .mockResolvedValueOnce(sampleResponse)
      .mockResolvedValueOnce(secondPageResponse)
    downloadWallpaper.mockResolvedValue({
      id: "download-000001",
      wallpaperId: "kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      status: "succeeded",
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    const pagesToDownloadInput = screen.getByLabelText(/Pages to download/i)
    await user.clear(pagesToDownloadInput)
    await user.type(pagesToDownloadInput, "2")
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))
    await user.click(
      await screen.findByRole("button", { name: /Download 2 pages/i }),
    )

    await waitFor(() => {
      expect(searchWallpapers).toHaveBeenNthCalledWith(2, {
        categories: "all",
        purity: { sfw: true, sketchy: false, nsfw: false },
        sorting: "date_added",
        q: "",
        page: 2,
      })
    })

    expect(downloadWallpaper).toHaveBeenCalledTimes(2)
    expect(downloadWallpaper).toHaveBeenNthCalledWith(1, {
      wallpaperId: "kxpkmm",
      imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      fileName: "wallhaven-kxpkmm.jpg",
    })
    expect(downloadWallpaper).toHaveBeenNthCalledWith(2, {
      wallpaperId: "213edy",
      imageUrl: "https://w.wallhaven.cc/full/21/wallhaven-213edy.png",
      fileName: "wallhaven-213edy.png",
    })
    expect(await screen.findByText(/Finished downloading 2 wallpapers/i)).toBeInTheDocument()
  })

  it("keeps a single-download button disabled until that download finishes even after bulk download completes", async () => {
    const singleWallpaper = multiWallpaperResponse.data[0]
    const bulkWallpaper = multiWallpaperResponse.data[1]
    const singleDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    const duplicatedBulkDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    const otherBulkDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    let singleWallpaperCallCount = 0

    vi.mocked(searchWallpapers).mockResolvedValue(multiWallpaperResponse)
    downloadWallpaper.mockImplementation(({ wallpaperId }) => {
      if (wallpaperId === singleWallpaper.id) {
        singleWallpaperCallCount += 1
        return singleWallpaperCallCount === 1
          ? singleDownload.promise
          : duplicatedBulkDownload.promise
      }

      if (wallpaperId === bulkWallpaper.id) {
        return otherBulkDownload.promise
      }

      throw new Error(`Unexpected wallpaper download: ${wallpaperId}`)
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    const singleDownloadButton = await screen.findByRole("button", {
      name: new RegExp(`Download wallpaper ${singleWallpaper.id}`, "i"),
    })

    await user.click(singleDownloadButton)
    expect(singleDownloadButton).toBeDisabled()

    const bulkDownloadButton = await screen.findByRole("button", {
      name: /Download current query/i,
    })
    await user.click(bulkDownloadButton)

    duplicatedBulkDownload.resolve(createDownloadResult(singleWallpaper))
    otherBulkDownload.resolve(createDownloadResult(bulkWallpaper))

    await waitFor(() => {
      expect(bulkDownloadButton).not.toBeDisabled()
    })

    expect(singleDownloadButton).toBeDisabled()

    singleDownload.resolve(createDownloadResult(singleWallpaper))

    await waitFor(() => {
      expect(singleDownloadButton).not.toBeDisabled()
    })
  })

  it("shows a sticky selection bar after selecting a search result and clears old selections after a new search", async () => {
    const nextSearchResponse: SearchWallpapersResponse = {
      data: [createWallpaper("pl9nq2")],
      meta: {
        currentPage: 1,
        lastPage: 1,
        perPage: "24",
        total: 1,
        query: "forest",
        seed: null,
      },
    }

    vi.mocked(searchWallpapers)
      .mockResolvedValueOnce(multiWallpaperResponse)
      .mockResolvedValueOnce(nextSearchResponse)

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    const selectWallpaperCheckbox = await screen.findByRole("checkbox", {
      name: /Select wallpaper kxpkmm/i,
    })
    await user.click(selectWallpaperCheckbox)

    expect(await screen.findByText(/1 selected/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Download selected/i })).toBeInTheDocument()
    expect(useUiShellStore.getState().selectedSearchIds).toEqual(["kxpkmm"])

    const queryInput = screen.getByLabelText(/Query/i)
    await user.clear(queryInput)
    await user.type(queryInput, "forest")
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByText(/Loaded 1 wallpaper/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Download selected/i }),
    ).not.toBeInTheDocument()
    expect(useUiShellStore.getState().selectedSearchIds).toEqual([])
  })

  it("downloads the selected wallpapers from the sticky selection bar", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue(multiWallpaperResponse)
    downloadWallpaper.mockResolvedValue(createDownloadResult(multiWallpaperResponse.data[0]))

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    await user.click(
      await screen.findByRole("checkbox", {
        name: /Select wallpaper kxpkmm/i,
      }),
    )
    await user.click(
      screen.getByRole("checkbox", {
        name: /Select wallpaper zz9xwy/i,
      }),
    )
    await user.click(screen.getByRole("button", { name: /Download selected/i }))

    await waitFor(() => {
      expect(downloadWallpaper).toHaveBeenCalledTimes(2)
    })

    expect(downloadWallpaper).toHaveBeenNthCalledWith(1, {
      wallpaperId: "kxpkmm",
      imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      fileName: "wallhaven-kxpkmm.jpg",
    })
    expect(downloadWallpaper).toHaveBeenNthCalledWith(2, {
      wallpaperId: "zz9xwy",
      imageUrl: "https://w.wallhaven.cc/full/zz/wallhaven-zz9xwy.jpg",
      fileName: "wallhaven-zz9xwy.jpg",
    })
  })

  it("skips wallpapers that are already downloading when starting a selected download", async () => {
    const singleWallpaper = multiWallpaperResponse.data[0]
    const selectedWallpaper = multiWallpaperResponse.data[1]
    const singleDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    const selectedDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    let singleWallpaperCallCount = 0

    vi.mocked(searchWallpapers).mockResolvedValue(multiWallpaperResponse)
    downloadWallpaper.mockImplementation(({ wallpaperId }) => {
      if (wallpaperId === singleWallpaper.id) {
        singleWallpaperCallCount += 1

        if (singleWallpaperCallCount > 1) {
          throw new Error(`Unexpected duplicate wallpaper download: ${wallpaperId}`)
        }

        return singleDownload.promise
      }

      if (wallpaperId === selectedWallpaper.id) {
        return selectedDownload.promise
      }

      throw new Error(`Unexpected wallpaper download: ${wallpaperId}`)
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))
    await user.click(
      await screen.findByRole("checkbox", {
        name: new RegExp(`Select wallpaper ${singleWallpaper.id}`, "i"),
      }),
    )
    await user.click(
      screen.getByRole("checkbox", {
        name: new RegExp(`Select wallpaper ${selectedWallpaper.id}`, "i"),
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(`Download wallpaper ${singleWallpaper.id}`, "i"),
      }),
    )

    await waitFor(() => {
      expect(downloadWallpaper).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole("button", { name: /Download selected/i }))

    await waitFor(() => {
      expect(downloadWallpaper).toHaveBeenCalledTimes(2)
    })

    expect(singleWallpaperCallCount).toBe(1)
    expect(downloadWallpaper).toHaveBeenNthCalledWith(2, {
      wallpaperId: selectedWallpaper.id,
      imageUrl: selectedWallpaper.path,
      fileName: "wallhaven-zz9xwy.jpg",
    })

    selectedDownload.resolve(createDownloadResult(selectedWallpaper))
    singleDownload.resolve(createDownloadResult(singleWallpaper))

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: new RegExp(`Download wallpaper ${singleWallpaper.id}`, "i"),
        }),
      ).not.toBeDisabled()
    })
  })

  it("skips wallpapers that are already downloading when bulk download starts during a selected download", async () => {
    const selectedWallpaper = multiWallpaperResponse.data[0]
    const bulkWallpaper = multiWallpaperResponse.data[1]
    const selectedDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    const bulkDownload = createDeferred<ReturnType<typeof createDownloadResult>>()
    let selectedWallpaperCallCount = 0

    vi.mocked(searchWallpapers).mockResolvedValue(multiWallpaperResponse)
    downloadWallpaper.mockImplementation(({ wallpaperId }) => {
      if (wallpaperId === selectedWallpaper.id) {
        selectedWallpaperCallCount += 1

        if (selectedWallpaperCallCount > 1) {
          throw new Error(`Unexpected duplicate wallpaper download: ${wallpaperId}`)
        }

        return selectedDownload.promise
      }

      if (wallpaperId === bulkWallpaper.id) {
        return bulkDownload.promise
      }

      throw new Error(`Unexpected wallpaper download: ${wallpaperId}`)
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))
    await user.click(
      await screen.findByRole("checkbox", {
        name: new RegExp(`Select wallpaper ${selectedWallpaper.id}`, "i"),
      }),
    )
    await user.click(screen.getByRole("button", { name: /Download selected/i }))

    await waitFor(() => {
      expect(downloadWallpaper).toHaveBeenCalledTimes(1)
    })

    await user.click(screen.getByRole("button", { name: /Download current query/i }))

    await waitFor(() => {
      expect(downloadWallpaper).toHaveBeenCalledTimes(2)
    })

    expect(selectedWallpaperCallCount).toBe(1)
    expect(downloadWallpaper).toHaveBeenNthCalledWith(2, {
      wallpaperId: bulkWallpaper.id,
      imageUrl: bulkWallpaper.path,
      fileName: "wallhaven-zz9xwy.jpg",
    })

    bulkDownload.resolve(createDownloadResult(bulkWallpaper))
    selectedDownload.resolve(createDownloadResult(selectedWallpaper))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Download current query/i })).not.toBeDisabled()
    })
  })

  it("disables selection controls while selected download is running", async () => {
    const selectedWallpaper = multiWallpaperResponse.data[0]
    const selectedDownload = createDeferred<ReturnType<typeof createDownloadResult>>()

    vi.mocked(searchWallpapers).mockResolvedValue(multiWallpaperResponse)
    downloadWallpaper.mockImplementation(({ wallpaperId }) => {
      if (wallpaperId === selectedWallpaper.id) {
        return selectedDownload.promise
      }

      throw new Error(`Unexpected wallpaper download: ${wallpaperId}`)
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    const selectedCheckbox = await screen.findByRole("checkbox", {
      name: new RegExp(`Select wallpaper ${selectedWallpaper.id}`, "i"),
    })
    const otherCheckbox = screen.getByRole("checkbox", {
      name: /Select wallpaper zz9xwy/i,
    })

    await user.click(selectedCheckbox)
    await user.click(screen.getByRole("button", { name: /Download selected/i }))

    expect(screen.getByRole("button", { name: /Downloading selected/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Clear selection/i })).toBeDisabled()
    expect(selectedCheckbox).toBeDisabled()
    expect(otherCheckbox).toBeDisabled()

    selectedDownload.resolve(createDownloadResult(selectedWallpaper))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Clear selection/i })).not.toBeDisabled()
    })
  })

  it("disables visible download buttons for wallpapers that bulk download has not started yet", async () => {
    const deferredDownloads = new Map(
      multiChunkResponse.data.map((wallpaper) => [
        wallpaper.id,
        createDeferred<ReturnType<typeof createDownloadResult>>(),
      ]),
    )

    vi.mocked(searchWallpapers).mockResolvedValue(multiChunkResponse)
    downloadWallpaper.mockImplementation(({ wallpaperId }) => {
      const deferredDownload = deferredDownloads.get(wallpaperId)

      if (!deferredDownload) {
        throw new Error(`Unexpected wallpaper download: ${wallpaperId}`)
      }

      return deferredDownload.promise
    })

    render(<SearchPage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))
    await user.click(await screen.findByRole("button", { name: /Download current query/i }))

    const firstChunkWallpaperButton = screen.getByRole("button", {
      name: /Download wallpaper aa11aa/i,
    })
    const nextChunkWallpaperButton = screen.getByRole("button", {
      name: /Download wallpaper ee55ee/i,
    })

    await waitFor(() => {
      expect(firstChunkWallpaperButton).toBeDisabled()
    })

    expect(nextChunkWallpaperButton).toBeDisabled()
    expect(downloadWallpaper).toHaveBeenCalledTimes(4)

    for (const wallpaper of multiChunkResponse.data.slice(0, 4)) {
      deferredDownloads.get(wallpaper.id)?.resolve(createDownloadResult(wallpaper))
    }
    deferredDownloads.get("ee55ee")?.resolve(createDownloadResult(multiChunkResponse.data[4]))

    await waitFor(() => {
      expect(firstChunkWallpaperButton).not.toBeDisabled()
    })
  })

  it("shows the query validation error when the query is too long", async () => {
    render(<SearchPage />)

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Query/i), "x".repeat(201))
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Query is unexpectedly long.")
    expect(searchWallpapers).not.toHaveBeenCalled()
  })

  it("restores the previous filters and results after the page remounts", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse)

    const user = userEvent.setup()
    const firstRender = render(<SearchPage />)

    await user.type(screen.getByLabelText(/Query/i), "aurora")
    await user.clear(screen.getByLabelText(/Pages to download/i))
    await user.type(screen.getByLabelText(/Pages to download/i), "3")
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByText(/Loaded 1 wallpaper/i)).toBeInTheDocument()

    firstRender.unmount()
    render(<SearchPage />)

    expect(screen.getByLabelText(/Query/i)).toHaveValue("aurora")
    expect(screen.getByLabelText(/Pages to download/i)).toHaveValue(3)
    expect(screen.getByText(/Loaded 1 wallpaper/i)).toBeInTheDocument()
    expect(searchWallpapers).toHaveBeenCalledTimes(1)
  })

  it("keeps draft form values but clears stale results after remount when the draft diverges from the last submitted search", async () => {
    vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse)

    const user = userEvent.setup()
    const firstRender = render(<SearchPage />)

    await user.type(screen.getByLabelText(/Query/i), "aurora")
    await user.click(screen.getByRole("button", { name: /Search wallpapers/i }))

    expect(await screen.findByText(/Loaded 1 wallpaper/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Download current query/i })).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Query/i))
    await user.type(screen.getByLabelText(/Query/i), "forest")

    firstRender.unmount()
    render(<SearchPage />)

    expect(screen.getByLabelText(/Query/i)).toHaveValue("forest")
    expect(screen.queryByText(/Loaded 1 wallpaper/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Download current query/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Submit the form to load results from the Rust search command/i),
    ).toBeInTheDocument()
    expect(searchWallpapers).toHaveBeenCalledTimes(1)
  })
})
