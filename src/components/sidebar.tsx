import { Download, FolderOpen, Heart, Images, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/settings", label: "Settings", icon: Settings },
];

const collectionItems = [
  { label: "All wallpapers", count: 128, icon: FolderOpen },
  { label: "Nature", count: 36, icon: FolderOpen },
  { label: "City", count: 42, icon: FolderOpen },
  { label: "Favorites", count: 50, icon: Heart },
];

export function Sidebar() {
  const downloadSummary = useUiShellStore((state) => state.downloadSummary);

  return (
    <aside
      aria-label="sidebar"
      className="app-shell-sidebar flex h-full flex-col gap-6 border-b border-border bg-[var(--panel)] px-4 py-5 lg:border-r lg:border-b-0 lg:px-5 lg:py-6"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-500/35 bg-sky-500/8 text-sky-300 shadow-[0_0_0_1px_rgb(30_155_255_/_0.08)]">
            <Images className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">Wallhaven Desktop</p>
            <p className="text-sm text-muted-foreground">重新设计方案</p>
          </div>
        </div>

        <div className="space-y-2 text-sm leading-7 text-muted-foreground">
          <p>更现代、更高效、更可靠的 Wallhaven 桌面体验。</p>
          <p>专注于搜索、批量下载与本地归档管理。</p>
        </div>
      </div>

      <nav aria-label="Primary" className="space-y-1.5">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/14 text-foreground shadow-[inset_0_0_0_1px_rgb(30_155_255_/_0.2)]"
                    : "text-muted-foreground hover:bg-white/4 hover:text-foreground",
                )
              }
              key={item.to}
              to={item.to}
            >
              <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-3 rounded-2xl border border-border/80 bg-background/30 p-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>收藏</span>
          <span>设备</span>
        </div>
        <div className="space-y-1.5">
          {collectionItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm text-muted-foreground transition hover:bg-white/4 hover:text-foreground">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground/90">{item.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-auto rounded-2xl border border-border bg-card/90 p-4 shadow-[0_12px_32px_rgb(2_6_23_/_0.2)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">下载</p>
            <p className="mt-1 text-xs text-muted-foreground">当前任务概览</p>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-foreground/90">
            {downloadSummary.activeCount + downloadSummary.completedCount + downloadSummary.failedCount}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-border/80 bg-background/60 px-2 py-3">
            <dt className="text-muted-foreground">进行中</dt>
            <dd className="mt-1 text-base font-semibold text-foreground">{downloadSummary.activeCount}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/60 px-2 py-3">
            <dt className="text-muted-foreground">已完成</dt>
            <dd className="mt-1 text-base font-semibold text-foreground">{downloadSummary.completedCount}</dd>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/60 px-2 py-3">
            <dt className="text-muted-foreground">失败</dt>
            <dd className="mt-1 text-base font-semibold text-destructive">{downloadSummary.failedCount}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}
