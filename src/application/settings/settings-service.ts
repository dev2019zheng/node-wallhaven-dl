import {
  loadDownloadDirectorySettings,
  loadNetworkProxySettings,
  loadStoredWallhavenKey,
  loadUserPreferences,
  saveDownloadDirectorySettings,
  saveNetworkProxySettings,
  saveStoredWallhavenKey,
  saveUserPreferences,
} from "@/infrastructure/tauri/settings-repository";

import type { SaveSettingsInput, SettingsSnapshot } from "./settings.types";

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [wallhavenKey, downloadDirectory, networkProxy, preferences] = await Promise.all([
    loadStoredWallhavenKey(),
    loadDownloadDirectorySettings(),
    loadNetworkProxySettings(),
    loadUserPreferences(),
  ]);

  return {
    wallhavenKey,
    downloadDirectory,
    networkProxy,
    preferences,
  };
}

export async function saveSettings(input: SaveSettingsInput): Promise<SettingsSnapshot> {
  const customDownloadDirectoryPath = input.customDownloadDirectoryPath.trim();
  const networkProxyAddress = input.networkProxyAddress.trim();
  const networkProxy = networkProxyAddress
    ? {
        scheme: input.networkProxyScheme,
        address: networkProxyAddress,
      }
    : null;
  const [downloadDirectory, savedNetworkProxy, preferences] = await Promise.all([
    saveDownloadDirectorySettings(customDownloadDirectoryPath ? customDownloadDirectoryPath : null),
    saveNetworkProxySettings(networkProxy),
    saveUserPreferences(input.preferences),
  ]);
  await saveStoredWallhavenKey(input.wallhavenKey);

  return {
    wallhavenKey: input.wallhavenKey,
    downloadDirectory,
    networkProxy: savedNetworkProxy,
    preferences,
  };
}
