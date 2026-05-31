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
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-primary/28 bg-[var(--panel)]/96 p-4 shadow-[var(--sticky-shadow)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">已选择 {selectedCount} 项</p>
        <p className="text-xs text-muted-foreground">下载选中项，或清除当前选择。</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button className="rounded-xl" onClick={onDownloadSelected} type="button" disabled={isDownloading}>
          {isDownloading ? "下载选中中..." : "下载选中"}
        </Button>
        <Button className="rounded-xl" disabled={isDownloading} onClick={onClear} type="button" variant="outline">
          清除选择
        </Button>
      </div>
    </div>
  );
}
