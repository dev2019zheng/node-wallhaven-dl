import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

import type {
  DownloadDirectorySettings,
  NetworkProxySettings,
  SettingsCommandError,
} from "@/application/settings/settings.types";
import { toSettingsCommandError } from "@/application/settings/settings.types";

const SETTINGS_STORE_PATH = "settings.json";
const WALLHAVEN_KEY_STORAGE_KEY = "WALLHAVEN_KEY";

async function withSettingsStore<T>(callback: (store: Store) => Promise<T>): Promise<T> {
  const store = await Store.load(SETTINGS_STORE_PATH);

  try {
    return await callback(store);
  } finally {
    await store.close();
  }
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
