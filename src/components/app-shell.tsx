import { Download, Images, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { cn } from "@/lib/utils";

type NavigationItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const navigationItems: NavigationItem[] = [
  {
    to: "/search",
    label: "Search",
    description: "Stage future filters, query builders, and search results.",
    icon: Search,
  },
  {
    to: "/downloads",
    label: "Downloads",
    description: "Track tasks, progress, and retry controls in one place.",
    icon: Download,
  },
  {
    to: "/gallery",
    label: "Gallery",
    description: "Review saved wallpapers and preview collection flows.",
    icon: Images,
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Manage API access and desktop storage defaults.",
    icon: Settings,
  },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Wallhaven Desktop</p>
            <h1 className="text-2xl font-semibold tracking-tight">Tauri v2 + React workspace scaffold</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Foundation first: routes, layout, testing, and desktop shell are ready for the next feature wave.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Legacy CLI kept in index.js for migration reference
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <nav aria-label="Primary" className="grid gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  aria-label={item.label}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                      isActive
                        ? "border-sky-400/40 bg-sky-500/10 text-foreground shadow-sm"
                        : "border-border/80 bg-card/50 text-foreground/90 hover:border-sky-400/30 hover:bg-card",
                    )
                  }
                  key={item.to}
                  to={item.to}
                >
                  <div className="mt-0.5 rounded-xl border border-border/80 bg-background/70 p-2 text-sky-300 transition-colors group-hover:text-sky-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p aria-hidden="true" className="text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </NavLink>
              );
            })}
          </nav>

          <section className="rounded-3xl border border-border/80 bg-card/60 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Foundation laid in this task</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>React Router app shell and feature placeholders</li>
              <li>Tailwind CSS + shadcn/ui-ready component setup</li>
              <li>Vitest + React Testing Library baseline coverage</li>
              <li>Minimal Tauri v2 Rust shell and capabilities</li>
            </ul>
          </section>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
