import type { DownloadQueueFilter, DownloadsSummary } from "@/application/downloads/downloads-service"
import { cn } from "@/lib/utils"

type QueueTabConfig = {
  filter: DownloadQueueFilter
  label: string
  count: (summary: DownloadsSummary) => number
}

const queueTabs: QueueTabConfig[] = [
  {
    filter: "all",
    label: "All",
    count: (summary) => summary.totalCount,
  },
  {
    filter: "running",
    label: "Running",
    count: (summary) => summary.activeCount,
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
]

type QueueTabsProps = {
  activeFilter: DownloadQueueFilter
  summary: DownloadsSummary
  onChange: (filter: DownloadQueueFilter) => void
}

export function QueueTabs({ activeFilter, summary, onChange }: QueueTabsProps) {
  return (
    <div
      aria-label="Download queue filters"
      className="flex flex-wrap gap-2"
      role="tablist"
    >
      {queueTabs.map((tab) => {
        const isActive = tab.filter === activeFilter

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-sky-500/40 bg-sky-500/10 text-foreground"
                : "border-border/80 bg-background/70 text-muted-foreground hover:border-sky-400/30 hover:text-foreground",
            )}
            key={tab.filter}
            onClick={() => {
              onChange(tab.filter)
            }}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
              {tab.count(summary)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
