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

import { SettingsCommandError } from "@/application/settings/settings.types";

import {
  loadDownloadDirectorySettings,
  loadNetworkProxySettings,
  loadStoredWallhavenKey,
  saveDownloadDirectorySettings,
  saveNetworkProxySettings,
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

  it("invokes the Rust download directory settings command by name", async () => {
    vi.mocked(invoke).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Wallhaven",
      effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });

    await expect(loadDownloadDirectorySettings()).resolves.toEqual({
      customDirectoryPath: "/Users/test/Pictures/Wallhaven",
      effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });

    expect(invoke).toHaveBeenCalledWith("get_download_directory_settings");
  });

  it("saves the custom download directory through the Rust settings command", async () => {
    vi.mocked(invoke).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Curated",
      effectiveDirectoryPath: "/Users/test/Pictures/Curated",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });

    await expect(
      saveDownloadDirectorySettings("/Users/test/Pictures/Curated"),
    ).resolves.toEqual({
      customDirectoryPath: "/Users/test/Pictures/Curated",
      effectiveDirectoryPath: "/Users/test/Pictures/Curated",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });

    expect(invoke).toHaveBeenCalledWith("save_download_directory_settings", {
      request: {
        customDirectoryPath: "/Users/test/Pictures/Curated",
      },
    });
  });

  it("loads the saved network proxy settings through the Rust settings command", async () => {
    vi.mocked(invoke).mockResolvedValue({
      scheme: "socks5",
      address: "127.0.0.1:7897",
    });

    await expect(loadNetworkProxySettings()).resolves.toEqual({
      scheme: "socks5",
      address: "127.0.0.1:7897",
    });

    expect(invoke).toHaveBeenCalledWith("get_network_proxy_settings");
  });

  it("saves the network proxy settings through the Rust settings command", async () => {
    vi.mocked(invoke).mockResolvedValue({
      scheme: "http",
      address: "127.0.0.1:7897",
    });

    await expect(
      saveNetworkProxySettings({
        scheme: "http",
        address: "127.0.0.1:7897",
      }),
    ).resolves.toEqual({
      scheme: "http",
      address: "127.0.0.1:7897",
    });

    expect(invoke).toHaveBeenCalledWith("save_network_proxy_settings", {
      request: {
        proxy: {
          scheme: "http",
          address: "127.0.0.1:7897",
        },
      },
    });
  });

  it("clears the saved network proxy settings when the user disables the proxy", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    await expect(saveNetworkProxySettings(null)).resolves.toBeNull();

    expect(invoke).toHaveBeenCalledWith("save_network_proxy_settings", {
      request: {
        proxy: null,
      },
    });
  });

  it("preserves structured settings command failures for invalid custom directories", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "invalidRequest",
      message: "custom download directory must be an absolute path",
    });

    await expect(saveDownloadDirectorySettings("relative/path")).rejects.toEqual(
      new SettingsCommandError({
        kind: "invalidRequest",
        message: "custom download directory must be an absolute path",
      }),
    );
  });

  it("preserves structured settings command failures for invalid proxy addresses", async () => {
    vi.mocked(invoke).mockRejectedValue({
      kind: "invalidRequest",
      message: "proxy address must not include a scheme",
    });

    await expect(
      saveNetworkProxySettings({
        scheme: "http",
        address: "http://127.0.0.1:7897",
      }),
    ).rejects.toEqual(
      new SettingsCommandError({
        kind: "invalidRequest",
        message: "proxy address must not include a scheme",
      }),
    );
  });
});
