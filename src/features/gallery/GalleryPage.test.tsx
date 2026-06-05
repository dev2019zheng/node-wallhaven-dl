const {
  deleteGalleryItem,
  downloadWallpaper,
  loadInitialGalleryItems,
  loadSettingsPreferences,
  revealPath,
  setGalleryFavorite,
  updateGalleryTags,
  convertFileSrc,
  writeClipboardText,
} = vi.hoisted(() => ({
  deleteGalleryItem: vi.fn(),
  downloadWallpaper: vi.fn(),
  loadInitialGalleryItems: vi.fn(),
  loadSettingsPreferences: vi.fn(),
  revealPath: vi.fn(),
  setGalleryFavorite: vi.fn(),
  updateGalleryTags: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
  writeClipboardText: vi.fn(),
}))

vi.mock("@/application/downloads/downloads-service", () => ({
  downloadWallpaper,
}))

vi.mock("@/application/gallery/gallery-service", () => ({
  deleteGalleryItem,
  loadInitialGalleryItems,
  setGalleryFavorite,
  updateGalleryTags,
}))

vi.mock("@/application/settings/settings-service", () => ({
  loadSettingsPreferences,
}))

vi.mock("@/infrastructure/tauri/native-shell", () => ({
  revealPath,
}))

vi.mock("@/infrastructure/browser/clipboard", () => ({
  writeClipboardText,
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

function formatGalleryDate(date: Date): string {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
  const timePart = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":")

  return `${datePart} ${timePart}`
}

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0)
const sixDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 12, 0, 0)

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
      createdAt: formatGalleryDate(sixDaysAgo),
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
      createdAt: formatGalleryDate(sixDaysAgo),
    },
    {
      wallpaperId: "space4k",
      sourceUrl: "https://wallhaven.cc/w/space4k",
      fileName: "space-4k-ultra.jpg",
      relativeFilePath: "wallpapers/space-4k-ultra.jpg",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/space-4k-ultra.jpg",
      purity: "sfw",
      category: "general",
      tags: ["Space", "UHD"],
      isFavorite: false,
      createdAt: formatGalleryDate(today),
    },
  ],
  page: 1,
  pageSize: 60,
  total: 3,
}

describe("GalleryPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(convertFileSrc).mockImplementation((path: string) => `asset://${path}`)
    vi.mocked(writeClipboardText).mockResolvedValue(undefined)
    vi.mocked(loadSettingsPreferences).mockResolvedValue({
      launchAtLogin: false,
      confirmBeforeDelete: false,
      telemetryEnabled: false,
      cacheSizeBytes: 38_400_000,
    })
    vi.mocked(revealPath).mockResolvedValue(undefined)
    useUiShellStore.setState({
      galleryCollectionRequest: null,
      galleryView: "grid",
      toasts: [],
    })
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
    expect(screen.getByText("Archive empty")).toBeInTheDocument()
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
    expect(screen.getByText("Archive loaded")).toBeInTheDocument()
    expect(screen.getByText("Local asset · SFW · general")).toBeInTheDocument()
    expect(screen.queryByText(/3840 × 2160/i)).not.toBeInTheDocument()
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

  it("defaults the gallery archive to SFW wallpapers", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    expect(await screen.findByRole("button", { name: "SFW", pressed: true })).toBeInTheDocument()
    expect(screen.getAllByText("wallhaven-kxpkmm.jpg").length).toBeGreaterThan(0)
    expect(screen.getAllByText("space-4k-ultra.jpg").length).toBeGreaterThan(0)
    expect(screen.queryByText("forest-scene.png")).not.toBeInTheDocument()
  })

  it("filters the loaded archive locally from the gallery toolbar", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "All" }))
    await user.type(
      screen.getByRole("searchbox", { name: /Search local gallery/i }),
      "forest",
    )

    expect(screen.getAllByText("forest-scene.png").length).toBeGreaterThan(0)
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
  })

  it("applies sidebar collection requests to the gallery archive", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    expect((await screen.findAllByText("wallhaven-kxpkmm.jpg")).length).toBeGreaterThan(0)

    useUiShellStore.getState().requestGalleryCollection("Space")

    expect(await screen.findByText("space-4k-ultra.jpg")).toBeInTheDocument()
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
    expect(screen.queryByText("forest-scene.png")).not.toBeInTheDocument()
  })

  it("opens timeline groups as local gallery filters", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /Open group Today/i }))

    expect(screen.getAllByText("space-4k-ultra.jpg").length).toBeGreaterThan(0)
    expect(screen.queryByText("wallhaven-kxpkmm.jpg")).not.toBeInTheDocument()
    expect(screen.queryByText("forest-scene.png")).not.toBeInTheDocument()
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

  it("selects a non-default gallery card before opening it from the preview action", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("button", { name: /Preview wallpaper space4k/i }),
    )

    expect(screen.getByRole("img", { name: /Selected wallpaper space4k/i })).toBeInTheDocument()
    expect(screen.getByTestId("lightbox")).toHaveTextContent(
      "asset:///Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/space-4k-ultra.jpg",
    )
  })

  it("shows an error state when the gallery command fails", async () => {
    vi.mocked(loadInitialGalleryItems).mockRejectedValue(new Error("gallery unavailable"))

    render(<GalleryPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("gallery unavailable")
    expect(screen.getByText("Archive unavailable")).toBeInTheDocument()
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
      imageUrl: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
      fileName: "wallhaven-kxpkmm.jpg",
      purity: "sfw",
      category: "general",
    })
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Download queued")
    })
  })

  it("keeps the archived source link visible in the detail panel", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    expect(await screen.findByRole("link", { name: /Open source/i })).toHaveAttribute(
      "href",
      "https://wallhaven.cc/w/kxpkmm",
    )
  })

  it("copies the selected local file path", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    fireEvent.click(await screen.findByRole("button", { name: /Copy path/i }))

    expect(writeClipboardText).toHaveBeenCalledWith(
      "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Path copied")
    })
  })

  it("reveals the selected local file in the native shell", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /^Reveal$/i }))

    expect(revealPath).toHaveBeenCalledWith(
      "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wallhaven-kxpkmm.jpg",
    )
  })

  it("deletes the selected local wallpaper and removes it from the grid", async () => {
    vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse)
    vi.mocked(deleteGalleryItem).mockResolvedValue({ wallpaperId: "kxpkmm" })

    render(<GalleryPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: /^Delete$/i }))

    expect(deleteGalleryItem).toHaveBeenCalledWith({ wallpaperId: "kxpkmm" })
    await waitFor(() => {
      expect(useUiShellStore.getState().toasts[0]?.title).toBe("Wallpaper deleted")
    })
    expect(screen.queryAllByText("wallhaven-kxpkmm.jpg")).toHaveLength(0)
  })
})
