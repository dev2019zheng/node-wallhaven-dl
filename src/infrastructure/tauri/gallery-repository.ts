import { invoke } from "@tauri-apps/api/core"

import type {
  GalleryCommandError,
  GalleryItem,
  GalleryListRequest,
  GalleryListResponse,
  SetGalleryFavoriteInput,
  UpdateGalleryTagsInput,
} from "@/application/gallery/gallery.types"
import { toGalleryCommandError } from "@/application/gallery/gallery.types"

export async function listGalleryItems(
  request: GalleryListRequest,
): Promise<GalleryListResponse> {
  try {
    return await invoke<GalleryListResponse>("list_gallery_items", {
      request,
    })
  } catch (error) {
    throw toGalleryCommandError(error) as GalleryCommandError
  }
}

export async function setGalleryFavorite(
  request: SetGalleryFavoriteInput,
): Promise<GalleryItem> {
  try {
    return await invoke<GalleryItem>("set_gallery_favorite", {
      request,
    })
  } catch (error) {
    throw toGalleryCommandError(error) as GalleryCommandError
  }
}

export async function updateGalleryTags(
  request: UpdateGalleryTagsInput,
): Promise<GalleryItem> {
  try {
    return await invoke<GalleryItem>("update_gallery_tags", {
      request,
    })
  } catch (error) {
    throw toGalleryCommandError(error) as GalleryCommandError
  }
}
