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

const STORAGE_UNAVAILABLE_REASON =
  "Desktop settings storage is unavailable in this web preview. Run the app through Tauri to save settings, choose folders, and test Wallhaven connectivity.";

function createPreviewDownloadDirectory(): DownloadDirectorySettings {
  return {
    customDirectoryPath: "",
    effectiveDirectoryPath: "Desktop app default directory",
    defaultDirectoryPath: "Desktop app default directory",
    isUsingDefaultDirectory: true,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function isTauriBridgeUnavailable(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("Cannot read properties of undefined (reading 'invoke')") ||
    message.includes("__TAURI_INTERNALS__")
  );
}

async function loadOptionalSetting<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export async function loadSettings(): Promise<SettingsSnapshot> {
  let storageUnavailableReason: string | undefined;
  let downloadDirectory: DownloadDirectorySettings;

  try {
    downloadDirectory = await loadDownloadDirectorySettings();
  } catch (error) {
    if (!isTauriBridgeUnavailable(error)) {
      throw error;
    }

    storageUnavailableReason = STORAGE_UNAVAILABLE_REASON;
    downloadDirectory = createPreviewDownloadDirectory();
  }

  const [wallhavenKey, networkProxy, preferences] = await Promise.all([
    loadOptionalSetting(loadStoredWallhavenKey, ""),
    loadOptionalSetting(loadNetworkProxySettings, null),
    loadOptionalSetting(loadUserPreferencesFromRepository, defaultSettingsPreferences),
  ]);

  return {
    wallhavenKey,
    downloadDirectory,
    networkProxy,
    preferences,
    ...(storageUnavailableReason ? { storageUnavailableReason } : {}),
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
