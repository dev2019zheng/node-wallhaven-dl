import {
  loadDownloadDirectorySettings,
  loadNetworkProxySettings,
  loadStoredWallhavenKey,
  loadUserPreferences as loadUserPreferencesFromRepository,
  saveDownloadDirectorySettings,
  saveNetworkProxySettings,
  saveStoredWallhavenKey,
  saveUserPreferences,
} from "@/infrastructure/tauri/settings-repository";

import type {
  DownloadDirectorySettings,
  SaveSettingsInput,
  SettingsPreferences,
  SettingsSnapshot,
} from "./settings.types";

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [wallhavenKey, downloadDirectory, networkProxy, preferences] = await Promise.all([
    loadStoredWallhavenKey(),
    loadDownloadDirectorySettings(),
    loadNetworkProxySettings(),
    loadUserPreferencesFromRepository(),
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

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  return loadUserPreferencesFromRepository()
}

export async function loadDownloadDirectory(): Promise<DownloadDirectorySettings> {
  return loadDownloadDirectorySettings()
}
