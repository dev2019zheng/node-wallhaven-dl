const { listGalleryItems } = vi.hoisted(() => ({
  listGalleryItems: vi.fn(),
}))

vi.mock("@/infrastructure/tauri/gallery-repository", () => ({
  listGalleryItems,
}))

import { DEFAULT_GALLERY_PAGE_SIZE, loadInitialGalleryItems } from "./gallery-service"

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
})
