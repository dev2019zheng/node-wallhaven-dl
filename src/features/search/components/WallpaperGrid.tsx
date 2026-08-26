import { useState } from "react";

import type { SearchWallpaper } from "@/application/search/search.types";

import { SearchPreviewLightbox } from "./SearchPreviewLightbox";
import { WallpaperCard } from "./WallpaperCard";

const emptyDownloadingWallpaperIds = new Set<string>();

type WallpaperGridProps = {
  wallpapers: SearchWallpaper[];
  onDownload?: (wallpaper: SearchWallpaper) => void;
  onToggleSelection?: (wallpaperId: string, checked: boolean) => void;
  downloadingWallpaperIds?: ReadonlySet<string>;
  selectedWallpaperIds?: ReadonlySet<string>;
  selectionDisabled?: boolean;
};

export function WallpaperGrid({
  wallpapers,
  onDownload,
  onToggleSelection,
  downloadingWallpaperIds = emptyDownloadingWallpaperIds,
  selectedWallpaperIds = emptyDownloadingWallpaperIds,
  selectionDisabled = false,
}: WallpaperGridProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  return (
    <>
      <div
        className="wh-dense-bento grid max-h-none grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))] gap-[18px] overflow-visible pr-1 min-[1180px]:max-h-[calc(100vh-282px)] min-[1180px]:overflow-y-auto"
        style={{ contentVisibility: "auto", containIntrinsicSize: "932px 618px" }}
      >
        {wallpapers.map((wallpaper, index) => (
          <WallpaperCard
            isDownloading={downloadingWallpaperIds.has(wallpaper.id)}
            isSelected={selectedWallpaperIds.has(wallpaper.id)}
            isSelectionDisabled={selectionDisabled}
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
            onToggleSelection={
              onToggleSelection
                ? (checked) => {
                    onToggleSelection(wallpaper.id, checked);
                  }
                : undefined
            }
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
