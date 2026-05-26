import { listGalleryItems as listGalleryItemsInRepository } from "@/infrastructure/tauri/gallery-repository"

import type { GalleryListResponse } from "./gallery.types"

export const DEFAULT_GALLERY_PAGE_SIZE = 60

export async function loadInitialGalleryItems(): Promise<GalleryListResponse> {
  return listGalleryItemsInRepository({
    page: 1,
    pageSize: DEFAULT_GALLERY_PAGE_SIZE,
  })
}
