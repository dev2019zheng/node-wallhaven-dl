import {
  loadDefaultDownloadStrategy,
  loadStoredWallhavenKey,
  saveStoredWallhavenKey,
} from "@/infrastructure/tauri/settings-repository";

import type { DownloadStrategy, SaveSettingsInput, SettingsSnapshot } from "./settings.types";

const FALLBACK_DEFAULT_DOWNLOAD_STRATEGY: DownloadStrategy = {
  baseDir: "AppLocalData",
  relativePath: "wallpapers",
};

function getFallbackDefaultDownloadStrategy(error: unknown): DownloadStrategy {
  console.warn(
    "Failed to load default download strategy. Falling back to AppLocalData/wallpapers.",
    error,
  );

  return FALLBACK_DEFAULT_DOWNLOAD_STRATEGY;
}

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [wallhavenKey, defaultDownloadStrategy] = await Promise.all([
    loadStoredWallhavenKey(),
    loadDefaultDownloadStrategy().catch(getFallbackDefaultDownloadStrategy),
  ]);

  return {
    wallhavenKey,
    defaultDownloadStrategy,
  };
}

export async function saveSettings(input: SaveSettingsInput): Promise<void> {
  await saveStoredWallhavenKey(input.wallhavenKey);
}
