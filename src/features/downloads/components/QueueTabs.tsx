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
    label: "All",
    count: (summary) => summary.totalCount,
  },
  {
    filter: "running",
    label: "Downloading",
    count: (summary) => summary.runningCount,
  },
  {
    filter: "queued",
    label: "Queued",
    count: (summary) => summary.queuedCount,
  },
  {
    filter: "completed",
    label: "Completed",
    count: (summary) => summary.completedCount,
  },
  {
    filter: "failed",
    label: "Failed",
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
    <div aria-label="Download queue filters" className="grid grid-cols-5 gap-2" role="tablist">
      {queueTabs.map((tab) => {
        const isActive = tab.filter === activeFilter;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors",
              isActive
                ? "border-[#1e5a91] bg-[#123252] text-foreground"
                : "border-border bg-[var(--surface-deep)] text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
            key={tab.filter}
            onClick={() => {
              onChange(tab.filter);
            }}
            role="tab"
            type="button"
          >
            <span className="truncate">{tab.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {tab.count(summary)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
