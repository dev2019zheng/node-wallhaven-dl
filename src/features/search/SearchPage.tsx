import { FeaturePlaceholder } from "@/components/feature-placeholder";

export function SearchPage() {
  return (
    <FeaturePlaceholder
      bullets={[
        "Search form state, query presets, and validation hooks plug in here.",
        "Future Tauri commands can bridge Wallhaven API calls without rewriting layout.",
        "Search results, filters, and pagination can grow inside this route boundary.",
      ]}
      description="This route is reserved for future wallpaper discovery flows. The shell is intentionally thin, but the page boundary is stable for subsequent feature work."
      eyebrow="Feature scaffold"
      note="No search business logic is implemented in this task. The goal is to keep the route, layout, and test contract stable so feature work can land incrementally."
      status="Ready for feature development"
      title="Search workspace"
    />
  );
}
