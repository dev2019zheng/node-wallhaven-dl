const { deleteGalleryItem, listGalleryItems, setGalleryFavorite, updateGalleryTags } = vi.hoisted(() => ({
  deleteGalleryItem: vi.fn(),
  listGalleryItems: vi.fn(),
  setGalleryFavorite: vi.fn(),
  updateGalleryTags: vi.fn(),
}))

vi.mock("@/infrastructure/tauri/gallery-repository", () => ({
  deleteGalleryItem,
  listGalleryItems,
  setGalleryFavorite,
  updateGalleryTags,
}))

import {
  DEFAULT_GALLERY_PAGE_SIZE,
  deleteGalleryItem as deleteGalleryItemInService,
  loadInitialGalleryItems,
  setGalleryFavorite as setGalleryFavoriteInService,
  updateGalleryTags as updateGalleryTagsInService,
} from "./gallery-service"

describe("gallery-service", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("loads the first gallery page with the default size", async () => {
    const response = {
      items: [],
      page: 1,
      pageSize: DEFAULT_GALLERY_PAGE_SIZE,
      total: 0,
    }
    vi.mocked(listGalleryItems).mockResolvedValue(response)

    await expect(loadInitialGalleryItems()).resolves.toEqual(response)

    expect(listGalleryItems).toHaveBeenCalledWith({
      page: 1,
      pageSize: DEFAULT_GALLERY_PAGE_SIZE,
    })
  })

  it("persists gallery favorite changes through the repository", async () => {
    const item = {
      wallpaperId: "wh-1",
      sourceUrl: "https://wallhaven.cc/w/wh-1",
      fileName: "wh-1.jpg",
      relativeFilePath: "wallpapers/wh-1.jpg",
      absolutePath: "/tmp/wallpapers/wh-1.jpg",
      purity: "sfw",
      category: "general",
      tags: [],
      isFavorite: true,
      createdAt: "2026-05-24 12:00:00",
    }
    vi.mocked(setGalleryFavorite).mockResolvedValue(item)

    await expect(
      setGalleryFavoriteInService({ wallpaperId: "wh-1", isFavorite: true }),
    ).resolves.toEqual(item)

    expect(setGalleryFavorite).toHaveBeenCalledWith({
      wallpaperId: "wh-1",
      isFavorite: true,
    })
  })

  it("persists gallery tag changes through the repository", async () => {
    const item = {
      wallpaperId: "wh-1",
      sourceUrl: "https://wallhaven.cc/w/wh-1",
      fileName: "wh-1.jpg",
      relativeFilePath: "wallpapers/wh-1.jpg",
      absolutePath: "/tmp/wallpapers/wh-1.jpg",
      purity: "sfw",
      category: "general",
      tags: ["OLED"],
      isFavorite: false,
      createdAt: "2026-05-24 12:00:00",
    }
    vi.mocked(updateGalleryTags).mockResolvedValue(item)

    await expect(
      updateGalleryTagsInService({ wallpaperId: "wh-1", tags: ["OLED"] }),
    ).resolves.toEqual(item)

    expect(updateGalleryTags).toHaveBeenCalledWith({
      wallpaperId: "wh-1",
      tags: ["OLED"],
    })
  })

  it("deletes gallery items through the repository", async () => {
    vi.mocked(deleteGalleryItem).mockResolvedValue({
      wallpaperId: "wh-1",
    })

    await expect(
      deleteGalleryItemInService({ wallpaperId: "wh-1" }),
    ).resolves.toEqual({
      wallpaperId: "wh-1",
    })

    expect(deleteGalleryItem).toHaveBeenCalledWith({
      wallpaperId: "wh-1",
    })
  })
})
