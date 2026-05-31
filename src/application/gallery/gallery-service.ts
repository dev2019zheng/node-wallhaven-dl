import {
  deleteGalleryItem as deleteGalleryItemInRepository,
  listGalleryItems as listGalleryItemsInRepository,
  setGalleryFavorite as setGalleryFavoriteInRepository,
  updateGalleryTags as updateGalleryTagsInRepository,
} from "@/infrastructure/tauri/gallery-repository"

import type {
  DeleteGalleryItemInput,
  DeleteGalleryItemResult,
  GalleryItem,
  GalleryListResponse,
  SetGalleryFavoriteInput,
  UpdateGalleryTagsInput,
} from "./gallery.types"

export const DEFAULT_GALLERY_PAGE_SIZE = 60

export async function loadInitialGalleryItems(): Promise<GalleryListResponse> {
  return listGalleryItemsInRepository({
    page: 1,
    pageSize: DEFAULT_GALLERY_PAGE_SIZE,
  })
}

export async function setGalleryFavorite(
  input: SetGalleryFavoriteInput,
): Promise<GalleryItem> {
  return setGalleryFavoriteInRepository(input)
}

export async function updateGalleryTags(input: UpdateGalleryTagsInput): Promise<GalleryItem> {
  return updateGalleryTagsInRepository(input)
}

export async function deleteGalleryItem(
  input: DeleteGalleryItemInput,
): Promise<DeleteGalleryItemResult> {
  return deleteGalleryItemInRepository(input)
}
