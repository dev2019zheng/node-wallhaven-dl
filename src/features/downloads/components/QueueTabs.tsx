import type { DownloadQueueFilter, DownloadsSummary } from "@/application/downloads/downloads-service";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type QueueTabConfig = {
  filter: DownloadQueueFilter;
  labelKey: "tabs.all" | "tabs.downloading" | "tabs.queued" | "tabs.completed" | "tabs.failed";
  count: (summary: DownloadsSummary) => number;
};

const queueTabs: QueueTabConfig[] = [
  {
    filter: "all",
    labelKey: "tabs.all",
    count: (summary) => summary.totalCount,
  },
  {
    filter: "running",
    labelKey: "tabs.downloading",
    count: (summary) => summary.runningCount,
  },
  {
    filter: "queued",
    labelKey: "tabs.queued",
    count: (summary) => summary.queuedCount,
  },
  {
    filter: "completed",
    labelKey: "tabs.completed",
    count: (summary) => summary.completedCount,
  },
  {
    filter: "failed",
    labelKey: "tabs.failed",
    count: (summary) => summary.failedCount,
  },
];

type QueueTabsProps = {
  activeFilter: DownloadQueueFilter;
  summary: DownloadsSummary;
  onChange: (filter: DownloadQueueFilter) => void;
};

export function QueueTabs({ activeFilter, summary, onChange }: QueueTabsProps) {
  const { t } = useTranslation("downloads");

  return (
    <div aria-label={t("tabs.filters")} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="tablist">
      {queueTabs.map((tab) => {
        const isActive = tab.filter === activeFilter;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors",
              isActive
                ? "wh-selected-surface text-foreground"
                : "border-border bg-[var(--surface-deep)] text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
            key={tab.filter}
            onClick={() => {
              onChange(tab.filter);
            }}
            role="tab"
            type="button"
          >
            <span className="truncate">{t(tab.labelKey)}</span>
            <span className="text-[11px] text-muted-foreground">
              {tab.count(summary)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
