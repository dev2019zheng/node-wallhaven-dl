import { useState } from "react";

import type { SearchWallpaper } from "@/application/search/search.types";

import { SearchPreviewLightbox } from "./SearchPreviewLightbox";
import { SearchResultCard } from "./SearchResultCard";

const emptyDownloadingWallpaperIds = new Set<string>();

type SearchResultGridProps = {
  wallpapers: SearchWallpaper[];
  onDownload?: (wallpaper: SearchWallpaper) => void;
  downloadingWallpaperIds?: ReadonlySet<string>;
};

export function SearchResultGrid({
  wallpapers,
  onDownload,
  downloadingWallpaperIds = emptyDownloadingWallpaperIds,
}: SearchResultGridProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-5">
        {wallpapers.map((wallpaper, index) => (
          <SearchResultCard
            isDownloading={downloadingWallpaperIds.has(wallpaper.id)}
            key={wallpaper.id}
            onDownload={
              onDownload
                ? () => {
                    onDownload(wallpaper);
                  }
                : undefined
            }
            onPreview={() => {
              setPreviewIndex(index);
              setPreviewOpen(true);
            }}
            wallpaper={wallpaper}
          />
        ))}
      </div>

      <SearchPreviewLightbox
        index={previewIndex}
        onClose={() => setPreviewOpen(false)}
        onView={setPreviewIndex}
        open={previewOpen}
        wallpapers={wallpapers}
      />
    </>
  );
}
