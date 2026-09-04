import { Download, Images, Keyboard, Search, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUiShellStore } from "@/features/shell/ui-shell-store";
import { cn } from "@/lib/utils";

type ChromeCommand = {
  labelKey: "nav.search" | "nav.downloads" | "nav.gallery" | "nav.settings";
  to: string;
  icon: LucideIcon;
};

const quickNavigationCommands: ChromeCommand[] = [
  { labelKey: "nav.search", to: "/search", icon: Search },
  { labelKey: "nav.downloads", to: "/downloads", icon: Download },
  { labelKey: "nav.gallery", to: "/gallery", icon: Images },
  { labelKey: "nav.settings", to: "/settings", icon: Settings },
];

export function MacWindowChrome() {
  const { t } = useTranslation("shell");
  const location = useLocation();
  const navigate = useNavigate();
  const quickNavigationRef = useRef<HTMLDivElement | null>(null);
  const activeShellPanel = useUiShellStore((state) => state.activeShellPanel);
  const setActiveShellPanel = useUiShellStore((state) => state.setActiveShellPanel);

  useEffect(() => {
    if (activeShellPanel !== "quick-navigation") {
      return;
    }

    const closeQuickNavigation = () => {
      setActiveShellPanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeQuickNavigation();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        quickNavigationRef.current &&
        !quickNavigationRef.current.contains(target)
      ) {
        closeQuickNavigation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [activeShellPanel, setActiveShellPanel]);

  const toggleQuickNavigation = () => {
    setActiveShellPanel(activeShellPanel === "quick-navigation" ? null : "quick-navigation");
  };

  const runCommand = (to: string) => {
    navigate(to);
    setActiveShellPanel(null);
  };

  const commands = useMemo(
    () =>
      quickNavigationCommands.map((command) => ({
        ...command,
        label: t(command.labelKey),
      })),
    [t],
  );

  return (
    <header aria-label={t("nav.topBar")} className="wh-window-chrome">
      <div aria-hidden="true" />

      <div className="relative flex items-center gap-2" ref={quickNavigationRef}>
        <button
          aria-expanded={activeShellPanel === "quick-navigation"}
          aria-label={t("quickNav.button")}
          className="wh-chrome-button"
          onClick={toggleQuickNavigation}
          type="button"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 max-[640px]:hidden">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        {activeShellPanel ? (
          <div
            aria-label={t("quickNav.menu")}
            className="absolute right-0 top-[calc(100%+10px)] z-40 w-[min(18rem,calc(100vw-1.5rem))] rounded-[18px] border border-border bg-[var(--panel)] p-2 shadow-[var(--panel-shadow)]"
            role="menu"
          >
            {commands.map((command) => {
              const Icon = command.icon;
              const isActive = location.pathname === command.to;

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[13px] font-semibold transition hover:bg-[var(--surface-hover)] hover:text-foreground",
                    isActive ? "wh-selected-surface text-foreground" : "text-muted-foreground",
                  )}
                  key={command.to}
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
