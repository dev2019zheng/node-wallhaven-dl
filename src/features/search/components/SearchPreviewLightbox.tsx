import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

import type { SearchWallpaper } from "@/application/search/search.types";

type SearchPreviewLightboxProps = {
  wallpapers: SearchWallpaper[];
  index: number;
  open: boolean;
  onClose: () => void;
  onView: (index: number) => void;
};

export function SearchPreviewLightbox({
  wallpapers,
  index,
  open,
  onClose,
  onView,
}: SearchPreviewLightboxProps) {
  return (
    <Lightbox
      close={onClose}
      index={index}
      on={{
        view: ({ index: currentIndex }) => onView(currentIndex),
      }}
      open={open}
      plugins={[Zoom]}
      slides={wallpapers.map((wallpaper) => ({
        src: wallpaper.path,
      }))}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
      }}
    />
  );
}
