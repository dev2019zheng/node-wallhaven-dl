import { Download, Heart, Images, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import {
  type GalleryCollectionShortcut,
  useUiShellStore,
} from "@/features/shell/ui-shell-store";

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

const collectionItems: Array<{ label: GalleryCollectionShortcut; icon: LucideIcon }> = [
  { label: "Favorites", icon: Heart },
  { label: "4K Ultra", icon: Heart },
  { label: "Nature", icon: Heart },
  { label: "Anime", icon: Heart },
  { label: "Space", icon: Heart },
];

export function Sidebar() {
  const navigate = useNavigate();
  const downloadSummary = useUiShellStore((state) => state.downloadSummary);
  const requestGalleryCollection = useUiShellStore((state) => state.requestGalleryCollection);

  return (
    <aside
      aria-label="sidebar"
      className="app-shell-sidebar flex flex-col gap-6 border border-border bg-[var(--sidebar)] px-[18px] py-6"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary shadow-[0_0_0_1px_rgb(47_139_255_/_0.1)]">
            <span className="text-lg font-bold">W</span>
          </div>
          <div>
            <p className="text-[16px] font-semibold tracking-tight text-foreground">Wallhaven</p>
            <p className="text-[13px] font-medium text-muted-foreground">Desktop</p>
          </div>
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
                  "group flex h-[42px] items-center gap-3 rounded-[14px] border px-3 text-[14px] font-semibold transition-colors",
                  isActive
                    ? "wh-selected-surface text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-[var(--surface-hover)]/65 hover:text-foreground",
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

      <div className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>Collections</span>
        </div>
        <div className="space-y-1.5">
          {collectionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className="flex h-[32px] w-full items-center justify-between rounded-xl px-2 text-left text-[13px] font-medium text-muted-foreground transition hover:bg-[var(--surface-hover)]/65 hover:text-foreground"
                key={item.label}
                onClick={() => {
                  requestGalleryCollection(item.label);
                  navigate("/gallery");
                }}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="mt-auto rounded-[14px] border border-border bg-[var(--surface-deep)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,color-mix(in_srgb,var(--primary)_42%,#7042b9)_100%)]" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-foreground">zhengy</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase text-primary">Pro</p>
            </div>
          </div>
          <span className="rounded-full border border-primary/35 bg-primary/15 px-2.5 py-1 text-[10px] font-semibold text-primary">
            {downloadSummary.activeCount + downloadSummary.completedCount + downloadSummary.failedCount}
          </span>
        </div>
      </section>
    </aside>
  );
}
