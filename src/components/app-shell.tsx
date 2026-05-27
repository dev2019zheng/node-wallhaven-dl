import { Download, Images, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  {
    to: "/search",
    label: "Search",
    icon: Search,
  },
  {
    to: "/downloads",
    label: "Downloads",
    icon: Download,
  },
  {
    to: "/gallery",
    label: "Gallery",
    icon: Images,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-sky-400/30 bg-sky-500/10 p-2 text-sky-300">
                <Images className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-foreground">Wallhaven Desktop</p>
                <p className="text-xs text-muted-foreground">Browse, download, and archive wallpapers</p>
              </div>
            </div>

            <nav aria-label="Primary" className="overflow-x-auto">
              <div className="flex min-w-max justify-center gap-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      aria-label={item.label}
                      className={({ isActive }) =>
                        cn(
                          "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "border-sky-400/40 bg-sky-500/10 text-foreground shadow-sm"
                            : "border-border/80 bg-card/50 text-foreground/90 hover:border-sky-400/30 hover:bg-card",
                        )
                      }
                      key={item.to}
                      to={item.to}
                    >
                      <Icon className="h-4 w-4 text-sky-300 transition-colors group-hover:text-sky-200" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </nav>

            <div aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
