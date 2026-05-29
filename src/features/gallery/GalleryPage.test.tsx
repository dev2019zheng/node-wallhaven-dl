const { loadInitialGalleryItems, convertFileSrc } = vi.hoisted(() => ({
  loadInitialGalleryItems: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock("@/application/gallery/gallery-service", () => ({
  loadInitialGalleryItems,
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

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { GalleryListResponse } from "@/application/gallery/gallery.types"
import { useUiShellStore } from "@/features/shell/ui-shell-store"

import { GalleryPage } from "./GalleryPage"

const sampleResponse: GalleryListResponse = {
  items: [
    {
      wallpaperId: "kxpkmm",
      sourceUrl: "https://wallhaven.cc/w/kxpkmm",
      fileName: "wallhaven-kxpkmm.jpg",
      relativeFilePath: "wallpapers/wallhaven-kxpkmm.jpg",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
      createdAt: "2026-05-24 12:00:00",
    },
    {
      wallpaperId: "pqrs12",
      sourceUrl: "https://wallhaven.cc/w/pqrs12",
      fileName: "forest-scene.png",
      relativeFilePath: "wallpapers/forest-scene.png",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/forest-scene.png",
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
    useUiShellStore.setState({ galleryView: "grid" })
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

    const previewImage = await screen.findByRole("img", { name: /Wallpaper kxpkmm/i })

    expect(previewImage).toHaveAttribute(
      "src",
      "asset:///Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
    expect(screen.getByText("wallhaven-kxpkmm.jpg")).toBeInTheDocument()
    expect(screen.getByText("wallpapers/wallhaven-kxpkmm.jpg")).toBeInTheDocument()
  })

  it("renders a local gallery toolbar with search and view toggles", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    expect(
      await screen.findByRole("searchbox", { name: /search local gallery/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /grid view/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /compact view/i })).toBeInTheDocument()
  })

  it("filters the loaded archive locally from the gallery toolbar", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.type(
      await screen.findByRole("searchbox", { name: /search local gallery/i }),
      "forest",
    )

    expect(screen.getByText("forest-scene.png")).toBeInTheDocument()
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
  })

  it("persists the selected gallery view in the shell store", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /compact view/i }))

    expect(useUiShellStore.getState().galleryView).toBe("compact")
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

  it("does not show Favorites as an active collection slot", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    // Wait for the gallery to load
    await screen.findByText("wallhaven-kxpkmm.jpg")

    // The Favorites item should not be present as a collection slot
    expect(screen.queryByText(/Favorites/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Backend pending/i)).not.toBeInTheDocument()
  })
})
