import { FeaturePlaceholder } from "@/components/feature-placeholder";

export function GalleryPage() {
  return (
    <FeaturePlaceholder
      bullets={[
        "Rendered wallpaper collections can sit behind this route and share the same shell.",
        "Thumbnail virtualization and preview dialogs can be layered in without touching the nav contract.",
        "Future metadata caching can attach to the page boundary established here.",
      ]}
      description="Gallery is reserved for local wallpaper browsing and preview interactions once the downloader pipeline exists."
      eyebrow="Feature scaffold"
      status="Reserved for local library views"
      title="Gallery workspace"
    />
  );
}
