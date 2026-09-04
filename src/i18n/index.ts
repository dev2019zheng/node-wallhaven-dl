import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  type AppLocale,
  resolveInitialLocale,
  writeStoredLocale,
} from "@/i18n/locale-preference";

import enCommon from "@/i18n/locales/en/common.json";
import enShell from "@/i18n/locales/en/shell.json";
import enSearch from "@/i18n/locales/en/search.json";
import enDownloads from "@/i18n/locales/en/downloads.json";
import enGallery from "@/i18n/locales/en/gallery.json";
import enSettings from "@/i18n/locales/en/settings.json";

import zhCommon from "@/i18n/locales/zh/common.json";
import zhShell from "@/i18n/locales/zh/shell.json";
import zhSearch from "@/i18n/locales/zh/search.json";
import zhDownloads from "@/i18n/locales/zh/downloads.json";
import zhGallery from "@/i18n/locales/zh/gallery.json";
import zhSettings from "@/i18n/locales/zh/settings.json";

export const I18N_NAMESPACES = [
  "common",
  "shell",
  "search",
  "downloads",
  "gallery",
  "settings",
] as const;

const resources = {
  en: {
    common: enCommon,
    shell: enShell,
    search: enSearch,
    downloads: enDownloads,
    gallery: enGallery,
    settings: enSettings,
  },
  zh: {
    common: zhCommon,
    shell: zhShell,
    search: zhSearch,
    downloads: zhDownloads,
    gallery: zhGallery,
    settings: zhSettings,
  },
} as const;

let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(options?: { lng?: AppLocale }): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    if (options?.lng && i18n.language !== options.lng) {
      void i18n.changeLanguage(options.lng);
    }
    return Promise.resolve(i18n);
  }

  if (initPromise) {
    return initPromise;
  }

  const lng = options?.lng ?? resolveInitialLocale();

  initPromise = i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    defaultNS: "common",
    ns: [...I18N_NAMESPACES],
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  }).then(() => i18n);

  return initPromise;
}

/** Persist preference and switch language without reload. */
export async function setAppLocale(locale: AppLocale): Promise<void> {
  writeStoredLocale(locale);
  if (!i18n.isInitialized) {
    await initI18n({ lng: locale });
    return;
  }
  await i18n.changeLanguage(locale);
}

export default i18n;
