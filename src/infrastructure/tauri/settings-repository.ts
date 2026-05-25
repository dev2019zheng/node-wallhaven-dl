import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

import type { DownloadStrategy } from "@/application/settings/settings.types";

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

export async function loadDefaultDownloadStrategy(): Promise<DownloadStrategy> {
  return invoke<DownloadStrategy>("get_default_download_strategy");
}
