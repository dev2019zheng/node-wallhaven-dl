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
import type { SearchWallpapersResponse } from "@/application/search/search.types"

import { SearchPage } from "./SearchPage"

const sampleResponse: SearchWallpapersResponse = {
  data: [
    {
      id: "kxpkmm",
      url: "https://wallhaven.cc/w/kxpkmm",
      shortUrl: "https://whvn.cc/kxpkmm",
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
      path: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      thumbs: {
        large: "https://th.wallhaven.cc/lg/kx/kxpkmm.jpg",
        original: "https://th.wallhaven.cc/orig/kx/kxpkmm.jpg",
        small: "https://th.wallhaven.cc/small/kx/kxpkmm.jpg",
      },
    },
  ],
  meta: {
    currentPage: 1,
    lastPage: 9,
    perPage: "24",
    total: 210,
    query: "aurora",
    seed: null,
  },
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

    const pageInput = screen.getByLabelText(/Page/i)
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
})
