import type { DownloadQueueFilter, DownloadsSummary } from "@/application/downloads/downloads-service";
import { cn } from "@/lib/utils";

type QueueTabConfig = {
  filter: DownloadQueueFilter;
  label: string;
  count: (summary: DownloadsSummary) => number;
};

const queueTabs: QueueTabConfig[] = [
  {
    filter: "all",
    label: "全部",
    count: (summary) => summary.totalCount,
  },
  {
    filter: "running",
    label: "下载中",
    count: (summary) => summary.activeCount,
  },
  {
    filter: "completed",
    label: "已完成",
    count: (summary) => summary.completedCount,
  },
  {
    filter: "failed",
    label: "失败",
    count: (summary) => summary.failedCount,
  },
];

type QueueTabsProps = {
  activeFilter: DownloadQueueFilter;
  summary: DownloadsSummary;
  onChange: (filter: DownloadQueueFilter) => void;
};

export function QueueTabs({ activeFilter, summary, onChange }: QueueTabsProps) {
  return (
    <div aria-label="Download queue filters" className="flex flex-wrap gap-2" role="tablist">
      {queueTabs.map((tab) => {
        const isActive = tab.filter === activeFilter;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary/45 bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_rgb(30_155_255_/_0.16)]"
                : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
            )}
            key={tab.filter}
            onClick={() => {
              onChange(tab.filter);
            }}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-white/6">
              {tab.count(summary)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
