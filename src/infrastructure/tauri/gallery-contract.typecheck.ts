import type { GalleryListResponse } from "@/application/gallery/gallery.types"

export const validGalleryListResponse: GalleryListResponse = {
  items: [
    {
      wallpaperId: "wh-1",
      sourceUrl: "https://wallhaven.cc/w/wh-1",
      fileName: "wh-1.jpg",
      relativeFilePath: "wallpapers/wh-1.jpg",
      absolutePath: "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers/wh-1.jpg",
      purity: "sfw",
      category: "general",
      tags: [],
      isFavorite: false,
      createdAt: "2026-05-24 12:00:00",
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
}

const invalidSnakeCaseGalleryItem = {
  wallpaperId: "wh-1",
  sourceUrl: "https://wallhaven.cc/w/wh-1",
  fileName: "wh-1.jpg",
  relativeFilePath: "wallpapers/wh-1.jpg",
  absolute_path: "/tmp/wh-1.jpg",
  createdAt: "2026-05-24 12:00:00",
}

export const invalidGalleryListResponse: GalleryListResponse = {
  items: [
    // @ts-expect-error gallery command responses must expose camelCase absolutePath
    invalidSnakeCaseGalleryItem,
  ],
  page: 1,
  pageSize: 20,
  total: 1,
}
