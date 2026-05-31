import { Bell, Search as SearchIcon, Settings2 } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

export function TopBar() {
  const globalQuery = useUiShellStore((state) => state.globalQuery);
  const setGlobalQuery = useUiShellStore((state) => state.setGlobalQuery);
  const downloadSummary = useUiShellStore((state) => state.downloadSummary);

  const totalObservedTasks =
    downloadSummary.activeCount + downloadSummary.completedCount + downloadSummary.failedCount;
  const taskStatusLabel =
    downloadSummary.activeCount > 0
      ? `${downloadSummary.activeCount} 个任务进行中`
      : totalObservedTasks > 0
        ? `已完成 ${downloadSummary.completedCount}，失败 ${downloadSummary.failedCount}`
        : "暂无活动任务";

  return (
    <header
      aria-label="top bar"
      className="app-shell-topbar border-b border-border bg-[var(--panel)]/96 px-5 py-4 backdrop-blur-xl lg:px-6"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <label className="relative block w-full max-w-2xl" htmlFor="shell-global-query">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-2xl border border-border bg-background/70 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              id="shell-global-query"
              onChange={(event) => {
                setGlobalQuery(event.currentTarget.value);
              }}
              placeholder="搜索关键词（支持标题、颜色、分辨率等）"
              type="search"
              value={globalQuery}
            />
          </label>

          <div className="hidden items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-2 text-sm text-muted-foreground xl:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>服务已连接</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            aria-label="Open settings shortcuts"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/50 text-muted-foreground transition hover:text-foreground"
            type="button"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            aria-label="Open task notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/50 text-muted-foreground transition hover:text-foreground"
            type="button"
          >
            <Bell className="h-4 w-4" />
            {downloadSummary.failedCount > 0 ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            ) : null}
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {taskStatusLabel}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            API 状态正常
          </span>
        </div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Wallhaven Desktop Workspace
        </div>
      </div>
    </header>
  );
}
