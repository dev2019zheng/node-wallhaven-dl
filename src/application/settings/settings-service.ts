import {
  loadDownloadDirectorySettings,
  loadNetworkProxySettings,
  loadStoredWallhavenKey,
  saveDownloadDirectorySettings,
  saveNetworkProxySettings,
  saveStoredWallhavenKey,
} from "@/infrastructure/tauri/settings-repository";

import type { SaveSettingsInput, SettingsSnapshot } from "./settings.types";

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [wallhavenKey, downloadDirectory, networkProxy] = await Promise.all([
    loadStoredWallhavenKey(),
    loadDownloadDirectorySettings(),
    loadNetworkProxySettings(),
  ]);

  return {
    wallhavenKey,
    downloadDirectory,
    networkProxy,
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
  const [downloadDirectory, savedNetworkProxy] = await Promise.all([
    saveDownloadDirectorySettings(customDownloadDirectoryPath ? customDownloadDirectoryPath : null),
    saveNetworkProxySettings(networkProxy),
  ]);
  await saveStoredWallhavenKey(input.wallhavenKey);

  return {
    wallhavenKey: input.wallhavenKey,
    downloadDirectory,
    networkProxy: savedNetworkProxy,
  };
}
