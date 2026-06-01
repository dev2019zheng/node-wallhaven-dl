import {
  defaultSettingsPreferences,
  diagnoseWallhavenAccess as diagnoseWallhavenAccessInRepository,
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
  WallhavenAccessDiagnostic,
} from "./settings.types";

type DiagnoseWallhavenAccessInput = {
  wallhavenKey?: string;
  networkProxyScheme: SaveSettingsInput["networkProxyScheme"];
  networkProxyAddress: string;
};

async function loadOptionalSetting<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export async function loadSettings(): Promise<SettingsSnapshot> {
  const [downloadDirectory, wallhavenKey, networkProxy, preferences] = await Promise.all([
    loadDownloadDirectorySettings(),
    loadOptionalSetting(loadStoredWallhavenKey, ""),
    loadOptionalSetting(loadNetworkProxySettings, null),
    loadOptionalSetting(loadUserPreferencesFromRepository, defaultSettingsPreferences),
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

export async function diagnoseWallhavenAccess(
  input: DiagnoseWallhavenAccessInput,
): Promise<WallhavenAccessDiagnostic> {
  const networkProxyAddress = input.networkProxyAddress.trim();
  const wallhavenKey = input.wallhavenKey?.trim();
  const request: Parameters<typeof diagnoseWallhavenAccessInRepository>[0] = {
    proxy: networkProxyAddress
      ? {
          scheme: input.networkProxyScheme,
          address: networkProxyAddress,
        }
      : null,
  };

  if (wallhavenKey) {
    request.apiKey = wallhavenKey;
  }

  return diagnoseWallhavenAccessInRepository(request);
}

export async function loadSettingsPreferences(): Promise<SettingsPreferences> {
  return loadUserPreferencesFromRepository()
}

export async function loadDownloadDirectory(): Promise<DownloadDirectorySettings> {
  return loadDownloadDirectorySettings()
}
