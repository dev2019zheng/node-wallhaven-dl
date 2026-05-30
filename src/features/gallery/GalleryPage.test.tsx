const {
  downloadWallpaper,
  loadInitialGalleryItems,
  setGalleryFavorite,
  updateGalleryTags,
  convertFileSrc,
} = vi.hoisted(() => ({
  downloadWallpaper: vi.fn(),
  loadInitialGalleryItems: vi.fn(),
  setGalleryFavorite: vi.fn(),
  updateGalleryTags: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock("@/application/downloads/downloads-service", () => ({
  downloadWallpaper,
}))

vi.mock("@/application/gallery/gallery-service", () => ({
  loadInitialGalleryItems,
  setGalleryFavorite,
  updateGalleryTags,
}))

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc,
}))

vi.mock("yet-another-react-lightbox", () => ({
  default: ({
    open,
    index,
    slides,
  }: {
    open: boolean
    index: number
    slides: Array<{ src: string }>
  }) => (open ? <div data-testid="lightbox">{slides[index]?.src}</div> : null),
}))

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { GalleryListResponse } from "@/application/gallery/gallery.types"
import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { GalleryPage } from "./GalleryPage"

const clipboardWriteText = vi.fn()

const sampleResponse: GalleryListResponse = {
  items: [
    {
      wallpaperId: "kxpkmm",
      sourceUrl: "https://wallhaven.cc/w/kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
      purity: "sfw",
      category: "general",
      tags: ["Nature"],
      isFavorite: false,
      createdAt: "2026-05-24 12:00:00",
    },
    {
      wallpaperId: "pqrs12",
      sourceUrl: "https://wallhaven.cc/w/pqrs12",
      fileName: "forest-scene.png",
      relativeFilePath: "wallpapers/forest-scene.png",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/forest-scene.png",
      purity: "sketchy",
      category: "anime",
      tags: ["Forest"],
      isFavorite: true,
      createdAt: "2026-05-25 09:30:00",
    },
  ],
  page: 1,
  pageSize: 60,
  total: 2,
}

describe("GalleryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(convertFileSrc).mockImplementation((path: string) => `asset://${path}`)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText.mockResolvedValue(undefined),
      },
    })
    useUiShellStore.setState({ galleryView: "grid", toasts: [] })
  })

  it("loads gallery items on entry and renders an empty state when the archive is empty", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 60,
      total: 0,
    })

    render(<GalleryPage />)

    expect(loadInitialGalleryItems).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/No archived wallpapers yet/i)).toBeInTheDocument()
  })

  it("renders archived wallpaper cards using local asset URLs", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const [previewImage] = await screen.findAllByRole("img", { name: /Wallpaper kxpkmm/i })

    expect(previewImage).toHaveAttribute(
      "src",
      "asset:///Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
    expect(screen.getAllByText("wallhaven-kxpkmm.jpg").length).toBeGreaterThan(0)
    expect(screen.getAllByText("wallpapers/wallhaven-kxpkmm.jpg").length).toBeGreaterThan(0)
  })

  it("renders a local gallery toolbar with search and view toggles", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    expect(
      await screen.findByRole("searchbox", { name: /Search local gallery/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Grid$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /List view/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Favorites/i })).toBeInTheDocument()
  })

  it("filters the loaded archive locally from the gallery toolbar", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.type(
      await screen.findByRole("searchbox", { name: /Search local gallery/i }),
      "forest",
    )

    expect(screen.getAllByText("forest-scene.png").length).toBeGreaterThan(0)
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
  })

  it("persists the selected gallery view in the shell store", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /List view/i }))

    expect(useUiShellStore.getState().galleryView).toBe("list")
  })

  it("opens a preview lightbox for the selected local wallpaper", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /Preview wallpaper kxpkmm/i }),
    )

    expect(screen.getByTestId("lightbox")).toHaveTextContent(
      "asset:///Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
  })

  it("shows an error state when the gallery command fails", async () => {
    vi.mocked(loadInitialGalleryItems).mockRejectedValue(new Error("gallery unavailable"))

    render(<GalleryPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("gallery unavailable")
  })

  it("filters the local archive with v3 collection chips", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    await screen.findAllByRole("img", { name: /Wallpaper kxpkmm/i })

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: /Favorites/i }))

    expect(screen.getAllByText("forest-scene.png").length).toBeGreaterThan(0)
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
  })

  it("persists favorite changes from gallery cards", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)
    vi.mocked(setGalleryFavorite).mockResolvedValue({
      ...sampleResponse.items[0],
      isFavorite: true,
    })

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /Favorite wallpaper kxpkmm/i }),
    )

    expect(setGalleryFavorite).toHaveBeenCalledWith({
      wallpaperId: "kxpkmm",
      isFavorite: true,
    })
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Added to favorites")
    })
  })

  it("saves custom gallery tags from the detail panel", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)
    vi.mocked(updateGalleryTags).mockResolvedValue({
      ...sampleResponse.items[0],
      tags: ["OLED", "Landscape"],
    })

    render(<GalleryPage />)

    const user = userEvent.setup()
    const tagsInput = await screen.findByRole("textbox", { name: /Edit gallery tags/i })
    fireEvent.change(tagsInput, { target: { value: "OLED, Landscape" } })
    await user.click(screen.getByRole("button", { name: /Save tags/i }))

    expect(updateGalleryTags).toHaveBeenCalledWith({
      wallpaperId: "kxpkmm",
      tags: ["OLED", "Landscape"],
    })
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Tags saved")
    })
  })

  it("queues a gallery wallpaper download with preserved purity metadata", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)
    vi.mocked(downloadWallpaper).mockResolvedValue({
      id: "download-kxpkmm",
      wallpaperId: "kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      status: "queued",
    })

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /^Download$/i }))

    expect(downloadWallpaper).toHaveBeenCalledWith({
      wallpaperId: "kxpkmm",
      imageUrl: "https://wallhaven.cc/w/kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      purity: "sfw",
      category: "general",
    })
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Download queued")
    })
  })

  it("copies the selected local file path", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    fireEvent.click(await screen.findByRole("button", { name: /Copy path/i }))

    expect(clipboardWriteText).toHaveBeenCalledWith(
      "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Path copied")
    })
  })
})
