import {
  loadDownloadDirectorySettings,
  loadStoredWallhavenKey,
  saveDownloadDirectorySettings,
  saveStoredWallhavenKey,
} from "@/infrastructure/tauri/settings-repository";

import type { SaveSettingsInput, SettingsSnapshot } from "./settings.types";

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [wallhavenKey, downloadDirectory] = await Promise.all([
    loadStoredWallhavenKey(),
    loadDownloadDirectorySettings(),
  ]);

  return {
    wallhavenKey,
    downloadDirectory,
  };
}

export async function saveSettings(input: SaveSettingsInput): Promise<SettingsSnapshot> {
  const customDownloadDirectoryPath = input.customDownloadDirectoryPath.trim();
  const downloadDirectory = await saveDownloadDirectorySettings(
    customDownloadDirectoryPath ? customDownloadDirectoryPath : null,
  );
  await saveStoredWallhavenKey(input.wallhavenKey);

  return {
    wallhavenKey: input.wallhavenKey,
    downloadDirectory,
  };
}
