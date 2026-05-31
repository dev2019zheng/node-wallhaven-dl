import Lightbox from "yet-another-react-lightbox"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import "yet-another-react-lightbox/styles.css"

type GalleryPreviewSlide = {
  assetUrl: string
  fileName: string
}

type GalleryPreviewLightboxProps = {
  items: GalleryPreviewSlide[]
  index: number
  open: boolean
  onClose: () => void
  onView: (index: number) => void
}

export function GalleryPreviewLightbox({
  items,
  index,
  open,
  onClose,
  onView,
}: GalleryPreviewLightboxProps) {
  return (
    <Lightbox
      close={onClose}
      index={index}
      on={{
        view: ({ index: currentIndex }) => onView(currentIndex),
      }}
      open={open}
      plugins={[Zoom]}
      slides={items.map((item) => ({
        src: item.assetUrl,
        alt: item.fileName,
      }))}
      zoom={{
        maxZoomPixelRatio: 3,
        scrollToZoom: true,
      }}
    />
  )
}
