export const LOCALE_STORAGE_KEY = "wallhaven-locale";

export type AppLocale = "en" | "zh";

export function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "zh";
}

export function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: AppLocale): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore quota / private-mode failures; in-memory i18n language still applies.
  }
}

export function detectNavigatorLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const language = navigator.language ?? "";
  return language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** Resolve locale: saved preference → navigator zh* → en */
export function resolveInitialLocale(): AppLocale {
  return readStoredLocale() ?? detectNavigatorLocale();
}

export function toggleLocale(current: string): AppLocale {
  return current.startsWith("zh") ? "en" : "zh";
}
