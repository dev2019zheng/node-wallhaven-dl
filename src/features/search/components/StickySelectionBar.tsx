import { Button } from "@/components/ui/button";

type StickySelectionBarProps = {
  selectedCount: number;
  onClear: () => void;
  onDownloadSelected: () => void;
  isDownloading?: boolean;
};

export function StickySelectionBar({
  selectedCount,
  onClear,
  onDownloadSelected,
  isDownloading = false,
}: StickySelectionBarProps) {
  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-border/80 bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{selectedCount} selected</p>
        <p className="text-xs text-muted-foreground">
          Download the checked wallpapers or clear the current selection.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onDownloadSelected} type="button" disabled={isDownloading}>
          {isDownloading ? "Downloading selected..." : "Download selected"}
        </Button>
        <Button disabled={isDownloading} onClick={onClear} type="button" variant="outline">
          Clear selection
        </Button>
      </div>
    </div>
  );
}
