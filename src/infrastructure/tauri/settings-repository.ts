import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

import type {
  DownloadDirectorySettings,
  NetworkProxySettings,
  SettingsCommandError,
  SettingsPreferences,
} from "@/application/settings/settings.types";
import { toSettingsCommandError } from "@/application/settings/settings.types";

const SETTINGS_STORE_PATH = "settings.json";
const WALLHAVEN_KEY_STORAGE_KEY = "WALLHAVEN_KEY";
const USER_PREFERENCES_STORAGE_KEY = "USER_PREFERENCES";
export const defaultSettingsPreferences: SettingsPreferences = {
  launchAtLogin: false,
  confirmBeforeDelete: true,
  telemetryEnabled: false,
  cacheSizeBytes: 38_400_000,
};

async function withSettingsStore<T>(callback: (store: Store) => Promise<T>): Promise<T> {
  const store = await Store.load(SETTINGS_STORE_PATH);
  let result!: T;

  try {
    result = await callback(store);
  } finally {
    try {
      await store.close();
    } catch {
      // Closing releases a Tauri resource, but a close failure should not invalidate a completed read/write.
    }
  }

  return result;
}

export async function loadStoredWallhavenKey(): Promise<string> {
  return withSettingsStore(async (store) => {
    const storedValue = await store.get<string>(WALLHAVEN_KEY_STORAGE_KEY);
    return typeof storedValue === "string" ? storedValue : "";
  });
}

export async function saveStoredWallhavenKey(wallhavenKey: string): Promise<void> {
  await withSettingsStore(async (store) => {
    await store.set(WALLHAVEN_KEY_STORAGE_KEY, wallhavenKey);
    await store.save();
  });
}

function normalizeSettingsPreferences(value: unknown): SettingsPreferences {
  if (!value || typeof value !== "object") {
    return { ...defaultSettingsPreferences };
  }

  const candidate = value as Partial<SettingsPreferences>;
  return {
    launchAtLogin:
      typeof candidate.launchAtLogin === "boolean"
        ? candidate.launchAtLogin
        : defaultSettingsPreferences.launchAtLogin,
    confirmBeforeDelete:
      typeof candidate.confirmBeforeDelete === "boolean"
        ? candidate.confirmBeforeDelete
        : defaultSettingsPreferences.confirmBeforeDelete,
    telemetryEnabled:
      typeof candidate.telemetryEnabled === "boolean"
        ? candidate.telemetryEnabled
        : defaultSettingsPreferences.telemetryEnabled,
    cacheSizeBytes:
      typeof candidate.cacheSizeBytes === "number" && Number.isFinite(candidate.cacheSizeBytes)
        ? candidate.cacheSizeBytes
        : defaultSettingsPreferences.cacheSizeBytes,
  };
}

export async function loadUserPreferences(): Promise<SettingsPreferences> {
  return withSettingsStore(async (store) => {
    const storedValue = await store.get<SettingsPreferences>(USER_PREFERENCES_STORAGE_KEY);
    return normalizeSettingsPreferences(storedValue);
  });
}

export async function saveUserPreferences(preferences: SettingsPreferences): Promise<SettingsPreferences> {
  const normalizedPreferences = normalizeSettingsPreferences(preferences);

  await withSettingsStore(async (store) => {
    await store.set(USER_PREFERENCES_STORAGE_KEY, normalizedPreferences);
    await store.save();
  });

  return normalizedPreferences;
}

export async function loadDownloadDirectorySettings(): Promise<DownloadDirectorySettings> {
  try {
    return await invoke<DownloadDirectorySettings>("get_download_directory_settings");
  } catch (error) {
    throw toSettingsCommandError(error) as SettingsCommandError;
  }
}

export async function saveDownloadDirectorySettings(
  customDirectoryPath: string | null,
): Promise<DownloadDirectorySettings> {
  try {
    return await invoke<DownloadDirectorySettings>("save_download_directory_settings", {
      request: {
        customDirectoryPath,
      },
    });
  } catch (error) {
    throw toSettingsCommandError(error) as SettingsCommandError;
  }
}

export async function loadNetworkProxySettings(): Promise<NetworkProxySettings | null> {
  try {
    return await invoke<NetworkProxySettings | null>("get_network_proxy_settings");
  } catch (error) {
    throw toSettingsCommandError(error) as SettingsCommandError;
  }
}

export async function saveNetworkProxySettings(
  proxy: NetworkProxySettings | null,
): Promise<NetworkProxySettings | null> {
  try {
    return await invoke<NetworkProxySettings | null>("save_network_proxy_settings", {
      request: {
        proxy,
      },
    });
  } catch (error) {
    throw toSettingsCommandError(error) as SettingsCommandError;
  }
}
