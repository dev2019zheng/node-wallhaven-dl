import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { themeAccentOptions, useThemeAccent } from "@/components/theme-accent-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { accent, isMounted: isAccentMounted, setAccent } = useThemeAccent();
  const [isThemeMounted, setIsThemeMounted] = useState(false);

  useEffect(() => {
    setIsThemeMounted(true);
  }, []);

  if (!isThemeMounted || !isAccentMounted) {
    return (
      <div className="theme-control-shell h-11 w-[11.75rem] animate-pulse" />
    );
  }

  const isDarkTheme = resolvedTheme !== "light";

  return (
    <div className="theme-control-shell">
      <Button
        aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
        className="h-8 rounded-full px-4 shadow-none"
        onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
        size="sm"
        type="button"
        variant="outline"
      >
        {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{isDarkTheme ? "Light" : "Dark"}</span>
      </Button>

      <div className="h-5 w-px bg-border" />

      <div aria-label="Accent theme" className="flex items-center gap-1" role="radiogroup">
        {themeAccentOptions.map((option) => {
          const isActive = option.value === accent;

          return (
            <button
              aria-checked={isActive}
              aria-label={`Use ${option.label} accent`}
              className={cn("theme-accent-option", isActive ? "shadow-[0_0_0_1px_var(--control-selected-border)]" : "")}
              data-active={isActive}
              key={option.value}
              onClick={() => setAccent(option.value)}
              role="radio"
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: option.color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
