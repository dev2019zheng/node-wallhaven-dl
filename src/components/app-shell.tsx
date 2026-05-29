import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="app-shell-grid min-h-screen lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-0">
        <Sidebar />

        <div className="min-w-0">
          <TopBar />
          <main className="app-shell-main min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
