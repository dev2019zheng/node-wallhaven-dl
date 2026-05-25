vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(),
  },
}));

import { invoke } from "@tauri-apps/api/core";
import { Store } from "@tauri-apps/plugin-store";

import {
  loadDefaultDownloadStrategy,
  loadStoredWallhavenKey,
  saveStoredWallhavenKey,
} from "./settings-repository";

type MockStore = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function createMockStore(): MockStore {
  return {
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
    close: vi.fn(),
  };
}

describe("settings-repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads WALLHAVEN_KEY from settings.json through the Tauri Store contract", async () => {
    const store = createMockStore();
    store.get.mockResolvedValue("stored-key");
    store.close.mockResolvedValue(undefined);
    vi.mocked(Store.load).mockResolvedValue(store as never);

    await expect(loadStoredWallhavenKey()).resolves.toBe("stored-key");

    expect(Store.load).toHaveBeenCalledWith("settings.json");
    expect(store.get).toHaveBeenCalledWith("WALLHAVEN_KEY");
    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it("normalizes non-string store values to an empty string", async () => {
    const store = createMockStore();
    store.get.mockResolvedValue(undefined);
    store.close.mockResolvedValue(undefined);
    vi.mocked(Store.load).mockResolvedValue(store as never);

    await expect(loadStoredWallhavenKey()).resolves.toBe("");
  });

  it("persists WALLHAVEN_KEY through set followed by save", async () => {
    const store = createMockStore();
    store.set.mockResolvedValue(undefined);
    store.save.mockResolvedValue(undefined);
    store.close.mockResolvedValue(undefined);
    vi.mocked(Store.load).mockResolvedValue(store as never);

    await saveStoredWallhavenKey("updated-key");

    expect(Store.load).toHaveBeenCalledWith("settings.json");
    expect(store.set).toHaveBeenCalledWith("WALLHAVEN_KEY", "updated-key");
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it("closes the store even when loading the key fails", async () => {
    const store = createMockStore();
    store.get.mockRejectedValue(new Error("store get failed"));
    store.close.mockResolvedValue(undefined);
    vi.mocked(Store.load).mockResolvedValue(store as never);

    await expect(loadStoredWallhavenKey()).rejects.toThrow("store get failed");
    expect(store.close).toHaveBeenCalledTimes(1);
  });

  it("invokes the Rust default strategy command by name", async () => {
    vi.mocked(invoke).mockResolvedValue({
      baseDir: "AppLocalData",
      relativePath: "wallpapers",
    });

    await expect(loadDefaultDownloadStrategy()).resolves.toEqual({
      baseDir: "AppLocalData",
      relativePath: "wallpapers",
    });

    expect(invoke).toHaveBeenCalledWith("get_default_download_strategy");
  });
});
