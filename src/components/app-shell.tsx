import { Outlet } from "react-router-dom";

import { MacWindowChrome } from "@/components/mac-window-chrome";
import { Sidebar } from "@/components/sidebar";

export function AppShell() {
  return (
    <div className="wh-desktop-shell bg-background text-foreground">
      <MacWindowChrome />

      <div className="wh-workspace">
        <Sidebar />

        <main className="app-shell-main min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
