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
  ],
  page: 1,
  pageSize: 60,
  total: 1,
}

describe("GalleryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(convertFileSrc).mockImplementation((path: string) => `asset://${path}`)
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
})
