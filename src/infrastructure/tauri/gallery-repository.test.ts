vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

import { invoke } from "@tauri-apps/api/core"

import {
  GalleryCommandError,
  type GalleryListResponse,
} from "@/application/gallery/gallery.types"

import { listGalleryItems, setGalleryFavorite, updateGalleryTags } from "./gallery-repository"

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
      tags: [],
      isFavorite: false,
      createdAt: "2026-05-24 12:00:00",
    },
  ],
  page: 1,
  pageSize: 60,
  total: 1,
}

describe("gallery-repository", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("invokes list_gallery_items with a structured Tauri request payload", async () => {
    vi.mocked(invoke).mockResolvedValue(sampleResponse)

    await expect(listGalleryItems({ page: 1, pageSize: 60 })).resolves.toEqual(sampleResponse)

    expect(invoke).toHaveBeenCalledWith("list_gallery_items", {
      request: {
        page: 1,
        pageSize: 60,
      },
    })
  })

  it("maps structured tauri command failures to GalleryCommandError", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "internal",
      message: "sqlite unavailable",
    })

    await expect(listGalleryItems({ page: 1, pageSize: 60 })).rejects.toEqual(
      new GalleryCommandError({
        kind: "internal",
        message: "sqlite unavailable",
      }),
    )
  })

  it("invokes set_gallery_favorite with a structured Tauri request payload", async () => {
    vi.mocked(invoke).mockResolvedValue(sampleResponse.items[0])

    await expect(
      setGalleryFavorite({ wallpaperId: "kxpkmm", isFavorite: true }),
    ).resolves.toEqual(sampleResponse.items[0])

    expect(invoke).toHaveBeenCalledWith("set_gallery_favorite", {
      request: {
        wallpaperId: "kxpkmm",
        isFavorite: true,
      },
    })
  })

  it("invokes update_gallery_tags with a structured Tauri request payload", async () => {
    const taggedItem = {
      ...sampleResponse.items[0],
      tags: ["OLED", "Landscape"],
    }
    vi.mocked(invoke).mockResolvedValue(taggedItem)

    await expect(
      updateGalleryTags({ wallpaperId: "kxpkmm", tags: ["OLED", "Landscape"] }),
    ).resolves.toEqual(taggedItem)

    expect(invoke).toHaveBeenCalledWith("update_gallery_tags", {
      request: {
        wallpaperId: "kxpkmm",
        tags: ["OLED", "Landscape"],
      },
    })
  })
})
