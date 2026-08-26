vi.mock("@/infrastructure/tauri/settings-repository", () => ({
  defaultSettingsPreferences: {
    launchAtLogin: false,
    confirmBeforeDelete: true,
    telemetryEnabled: false,
    cacheSizeBytes: 38_400_000,
  },
  diagnoseWallhavenAccess: vi.fn(),
  loadStoredWallhavenKey: vi.fn(),
  saveStoredWallhavenKey: vi.fn(),
  loadDownloadDirectorySettings: vi.fn(),
  saveDownloadDirectorySettings: vi.fn(),
  loadNetworkProxySettings: vi.fn(),
  saveNetworkProxySettings: vi.fn(),
  loadUserPreferences: vi.fn(),
  saveUserPreferences: vi.fn(),
}));

import {
  diagnoseWallhavenAccess as diagnoseWallhavenAccessInRepository,
  loadDownloadDirectorySettings,
  loadNetworkProxySettings,
  loadStoredWallhavenKey,
  loadUserPreferences,
  saveDownloadDirectorySettings,
  saveNetworkProxySettings,
  saveStoredWallhavenKey,
  saveUserPreferences,
} from "@/infrastructure/tauri/settings-repository";

import {
  diagnoseWallhavenAccess,
  loadSettings,
  saveSettings,
} from "./settings-service";

describe("settings-service", () => {
  const preferences = {
    launchAtLogin: false,
    confirmBeforeDelete: true,
    telemetryEnabled: false,
    cacheSizeBytes: 38_400_000,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadUserPreferences).mockResolvedValue(preferences);
    vi.mocked(saveUserPreferences).mockResolvedValue(preferences);
  });

  it("loads the stored key, download directory settings, and network proxy settings", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Wallhaven",
      effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });
    vi.mocked(loadNetworkProxySettings).mockResolvedValue({
      scheme: "socks5",
      address: "127.0.0.1:7897",
    });

    await expect(loadSettings()).resolves.toEqual({
      wallhavenKey: "stored-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Wallhaven",
        effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
      networkProxy: {
        scheme: "socks5",
        address: "127.0.0.1:7897",
      },
      preferences,
    });
  });

  it("fails when the download directory settings cannot be loaded", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDownloadDirectorySettings).mockRejectedValue(
      new Error("download directory unavailable"),
    );
    vi.mocked(loadNetworkProxySettings).mockResolvedValue(null);

    await expect(loadSettings()).rejects.toThrow("download directory unavailable");
  });

  it("keeps loading settings when optional stored values are unavailable", async () => {
    vi.mocked(loadStoredWallhavenKey).mockRejectedValue(new Error("key load failed"));
    vi.mocked(loadDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "",
      effectiveDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: true,
    });
    vi.mocked(loadNetworkProxySettings).mockRejectedValue(new Error("proxy decode failed"));
    vi.mocked(loadUserPreferences).mockRejectedValue(new Error("preferences load failed"));

    await expect(loadSettings()).resolves.toEqual({
      wallhavenKey: "",
      downloadDirectory: {
        customDirectoryPath: "",
        effectiveDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: true,
      },
      networkProxy: null,
      preferences,
    });
  });

  it("loads a read-only preview snapshot when the Tauri settings bridge is unavailable", async () => {
    vi.mocked(loadStoredWallhavenKey).mockRejectedValue(new Error("store unavailable"));
    vi.mocked(loadDownloadDirectorySettings).mockRejectedValue(
      new Error("Cannot read properties of undefined (reading 'invoke')"),
    );
    vi.mocked(loadNetworkProxySettings).mockRejectedValue(new Error("invoke unavailable"));
    vi.mocked(loadUserPreferences).mockRejectedValue(new Error("store unavailable"));

    await expect(loadSettings()).resolves.toEqual({
      wallhavenKey: "",
      downloadDirectory: {
        customDirectoryPath: "",
        effectiveDirectoryPath: "Desktop app default directory",
        defaultDirectoryPath: "Desktop app default directory",
        isUsingDefaultDirectory: true,
      },
      networkProxy: null,
      preferences,
      storageUnavailableReason:
        "Desktop settings storage is unavailable in this web preview. Run the app through Tauri to save settings, choose folders, and test Wallhaven connectivity.",
    });
  });

  it("persists the stored key, custom download directory, and network proxy through saveSettings", async () => {
    vi.mocked(saveStoredWallhavenKey).mockResolvedValue(undefined);
    vi.mocked(saveDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Curated",
      effectiveDirectoryPath: "/Users/test/Pictures/Curated",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });
    vi.mocked(saveNetworkProxySettings).mockResolvedValue({
      scheme: "socks5",
      address: "127.0.0.1:7897",
    });

    await saveSettings({
      wallhavenKey: "updated-key",
      customDownloadDirectoryPath: "/Users/test/Pictures/Curated",
      networkProxyScheme: "socks5",
      networkProxyAddress: "127.0.0.1:7897",
      preferences,
    });

    expect(saveStoredWallhavenKey).toHaveBeenCalledWith("updated-key");
    expect(saveDownloadDirectorySettings).toHaveBeenCalledWith(
      "/Users/test/Pictures/Curated",
    );
    expect(saveNetworkProxySettings).toHaveBeenCalledWith({
      scheme: "socks5",
      address: "127.0.0.1:7897",
    });
    expect(saveUserPreferences).toHaveBeenCalledWith(preferences);
  });

  it("disables the network proxy when the proxy address is blank", async () => {
    vi.mocked(saveStoredWallhavenKey).mockResolvedValue(undefined);
    vi.mocked(saveDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "",
      effectiveDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: true,
    });
    vi.mocked(saveNetworkProxySettings).mockResolvedValue(null);

    await saveSettings({
      wallhavenKey: "updated-key",
      customDownloadDirectoryPath: "",
      networkProxyScheme: "http",
      networkProxyAddress: "   ",
      preferences,
    });

    expect(saveNetworkProxySettings).toHaveBeenCalledWith(null);
  });

  it("diagnoses Wallhaven access with the current unsaved proxy and API key", async () => {
    vi.mocked(diagnoseWallhavenAccessInRepository).mockResolvedValue({
      usesProxy: true,
      authenticated: true,
      total: 42,
    });

    await expect(
      diagnoseWallhavenAccess({
        wallhavenKey: " test-key ",
        networkProxyScheme: "socks5",
        networkProxyAddress: " 127.0.0.1:7897 ",
      }),
    ).resolves.toEqual({
      usesProxy: true,
      authenticated: true,
      total: 42,
    });

    expect(diagnoseWallhavenAccessInRepository).toHaveBeenCalledWith({
      apiKey: "test-key",
      proxy: {
        scheme: "socks5",
        address: "127.0.0.1:7897",
      },
    });
  });

  it("diagnoses direct Wallhaven access when proxy and API key are blank", async () => {
    vi.mocked(diagnoseWallhavenAccessInRepository).mockResolvedValue({
      usesProxy: false,
      authenticated: false,
      total: 12,
    });

    await diagnoseWallhavenAccess({
      wallhavenKey: " ",
      networkProxyScheme: "http",
      networkProxyAddress: " ",
    });

    expect(diagnoseWallhavenAccessInRepository).toHaveBeenCalledWith({
      proxy: null,
    });
  });
});
