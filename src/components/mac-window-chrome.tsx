import { Download, HelpCircle, Images, Keyboard, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

type ChromeCommand = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const quickNavigationCommands: ChromeCommand[] = [
  { label: "Search", to: "/search", icon: Search },
  { label: "Downloads", to: "/downloads", icon: Download },
  { label: "Gallery", to: "/gallery", icon: Images },
  { label: "Settings", to: "/settings", icon: Settings },
];

const helpCommands: ChromeCommand[] = [
  { label: "Open Settings", to: "/settings", icon: Settings },
  { label: "Download Queue", to: "/downloads", icon: Download },
];

export function MacWindowChrome() {
  const navigate = useNavigate();
  const activeShellPanel = useUiShellStore((state) => state.activeShellPanel);
  const setActiveShellPanel = useUiShellStore((state) => state.setActiveShellPanel);

  const togglePanel = (panel: typeof activeShellPanel) => {
    setActiveShellPanel(activeShellPanel === panel ? null : panel);
  };

  const runCommand = (to: string) => {
    navigate(to);
    setActiveShellPanel(null);
  };

  return (
    <header aria-label="top bar" className="wh-window-chrome">
      <div aria-hidden="true" />

      <div className="relative flex items-center gap-2">
        <button
          aria-expanded={activeShellPanel === "quick-navigation"}
          aria-label="Quick navigation"
          className="wh-chrome-button"
          onClick={() => togglePanel("quick-navigation")}
          type="button"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <button
          aria-expanded={activeShellPanel === "help"}
          aria-label="Help"
          className="wh-chrome-button"
          onClick={() => togglePanel("help")}
          type="button"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <ThemeToggle />

        {activeShellPanel ? (
          <div
            aria-label={activeShellPanel === "quick-navigation" ? "Quick navigation commands" : "Help commands"}
            className="absolute right-0 top-[calc(100%+10px)] z-40 w-[min(18rem,calc(100vw-1.5rem))] rounded-[18px] border border-border bg-[var(--panel)] p-2 shadow-[var(--panel-shadow)]"
            role="menu"
          >
            {(activeShellPanel === "quick-navigation" ? quickNavigationCommands : helpCommands).map((command) => {
              const Icon = command.icon;

              return (
                <button
                  className="flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[13px] font-semibold text-muted-foreground transition hover:bg-[var(--surface-hover)] hover:text-foreground"
                  key={command.label}
                  onClick={() => runCommand(command.to)}
                  role="menuitem"
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  <span>{command.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}
