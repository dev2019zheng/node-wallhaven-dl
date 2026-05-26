import { invoke } from "@tauri-apps/api/core"

import type {
  GalleryCommandError,
  GalleryListRequest,
  GalleryListResponse,
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
