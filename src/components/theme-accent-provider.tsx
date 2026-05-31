import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const THEME_ACCENT_STORAGE_KEY = "wallhaven-theme-accent";

export const themeAccentOptions = [
  { value: "ocean", label: "Ocean", color: "#2f8bff" },
  { value: "sage", label: "Sage", color: "#3f9a77" },
  { value: "sunset", label: "Sunset", color: "#d97757" },
] as const;

export type ThemeAccent = (typeof themeAccentOptions)[number]["value"];

type ThemeAccentContextValue = {
  accent: ThemeAccent;
  isMounted: boolean;
  setAccent: (accent: ThemeAccent) => void;
};

const ThemeAccentContext = createContext<ThemeAccentContextValue | null>(null);

function isThemeAccent(value: string | null): value is ThemeAccent {
  return themeAccentOptions.some((option) => option.value === value);
}

export function ThemeAccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState<ThemeAccent>("ocean");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const storedAccent = window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY);

    if (isThemeAccent(storedAccent)) {
      setAccent(storedAccent);
      document.documentElement.dataset.accent = storedAccent;
    } else {
      document.documentElement.dataset.accent = "ocean";
    }

    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY, accent);
  }, [accent, isMounted]);

  return (
    <ThemeAccentContext.Provider value={{ accent, isMounted, setAccent }}>
      {children}
    </ThemeAccentContext.Provider>
  );
}

export function useThemeAccent() {
  const context = useContext(ThemeAccentContext);

  if (!context) {
    throw new Error("useThemeAccent must be used within ThemeAccentProvider.");
  }

  return context;
}
