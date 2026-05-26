vi.mock("@/infrastructure/tauri/settings-repository", () => ({
  loadStoredWallhavenKey: vi.fn(),
  saveStoredWallhavenKey: vi.fn(),
  loadDownloadDirectorySettings: vi.fn(),
  saveDownloadDirectorySettings: vi.fn(),
}));

import {
  loadDownloadDirectorySettings,
  loadStoredWallhavenKey,
  saveDownloadDirectorySettings,
  saveStoredWallhavenKey,
} from "@/infrastructure/tauri/settings-repository";

import { loadSettings, saveSettings } from "./settings-service";

describe("settings-service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the stored key and download directory settings", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Wallhaven",
      effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
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
    });
  });

  it("fails when the download directory settings cannot be loaded", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDownloadDirectorySettings).mockRejectedValue(
      new Error("download directory unavailable"),
    );

    await expect(loadSettings()).rejects.toThrow("download directory unavailable");
  });

  it("still fails when the stored key cannot be loaded", async () => {
    vi.mocked(loadStoredWallhavenKey).mockRejectedValue(new Error("key load failed"));
    vi.mocked(loadDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "",
      effectiveDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: true,
    });

    await expect(loadSettings()).rejects.toThrow("key load failed");
  });

  it("persists the stored key and custom download directory through saveSettings", async () => {
    vi.mocked(saveStoredWallhavenKey).mockResolvedValue(undefined);
    vi.mocked(saveDownloadDirectorySettings).mockResolvedValue({
      customDirectoryPath: "/Users/test/Pictures/Curated",
      effectiveDirectoryPath: "/Users/test/Pictures/Curated",
      defaultDirectoryPath:
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      isUsingDefaultDirectory: false,
    });

    await saveSettings({
      wallhavenKey: "updated-key",
      customDownloadDirectoryPath: "/Users/test/Pictures/Curated",
    });

    expect(saveStoredWallhavenKey).toHaveBeenCalledWith("updated-key");
    expect(saveDownloadDirectorySettings).toHaveBeenCalledWith(
      "/Users/test/Pictures/Curated",
    );
  });
});
