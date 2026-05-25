import { FeaturePlaceholder } from "@/components/feature-placeholder";

export function DownloadsPage() {
  return (
    <FeaturePlaceholder
      bullets={[
        "Download queue state and progress telemetry can be hosted in this slice.",
        "Retry, pause, and cancellation controls can attach to future Tauri commands.",
        "Persistent task history can later connect to Rust storage or local database layers.",
      ]}
      description="Downloads will eventually orchestrate wallpaper fetch tasks, progress, retries, and persistence. For now it is a stable placeholder route inside the desktop shell."
      eyebrow="Feature scaffold"
      status="Reserved for queue management"
      title="Downloads workspace"
    />
  );
}
