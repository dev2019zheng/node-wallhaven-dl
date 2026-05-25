vi.mock("@/infrastructure/tauri/settings-repository", () => ({
  loadStoredWallhavenKey: vi.fn(),
  saveStoredWallhavenKey: vi.fn(),
  loadDefaultDownloadStrategy: vi.fn(),
}));

import {
  loadDefaultDownloadStrategy,
  loadStoredWallhavenKey,
  saveStoredWallhavenKey,
} from "@/infrastructure/tauri/settings-repository";

import { loadSettings, saveSettings } from "./settings-service";

describe("settings-service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the stored key and default strategy", async () => {
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDefaultDownloadStrategy).mockResolvedValue({
      baseDir: "AppLocalData",
      relativePath: "wallpapers",
    });

    await expect(loadSettings()).resolves.toEqual({
      wallhavenKey: "stored-key",
      defaultDownloadStrategy: {
        baseDir: "AppLocalData",
        relativePath: "wallpapers",
      },
    });
  });

  it("falls back to AppLocalData/wallpapers when default strategy loading fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(loadStoredWallhavenKey).mockResolvedValue("stored-key");
    vi.mocked(loadDefaultDownloadStrategy).mockRejectedValue(new Error("default strategy unavailable"));

    await expect(loadSettings()).resolves.toEqual({
      wallhavenKey: "stored-key",
      defaultDownloadStrategy: {
        baseDir: "AppLocalData",
        relativePath: "wallpapers",
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load default download strategy. Falling back to AppLocalData/wallpapers.",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it("still fails when the stored key cannot be loaded", async () => {
    vi.mocked(loadStoredWallhavenKey).mockRejectedValue(new Error("key load failed"));
    vi.mocked(loadDefaultDownloadStrategy).mockResolvedValue({
      baseDir: "AppLocalData",
      relativePath: "wallpapers",
    });

    await expect(loadSettings()).rejects.toThrow("key load failed");
  });

  it("persists the stored key through saveSettings", async () => {
    vi.mocked(saveStoredWallhavenKey).mockResolvedValue(undefined);

    await saveSettings({ wallhavenKey: "updated-key" });

    expect(saveStoredWallhavenKey).toHaveBeenCalledWith("updated-key");
  });
});
