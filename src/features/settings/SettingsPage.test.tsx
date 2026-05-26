import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsPage } from "./SettingsPage";

vi.mock("@/application/settings/settings-service", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

import { SettingsCommandError } from "@/application/settings/settings.types";
import { loadSettings, saveSettings } from "@/application/settings/settings-service";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the saved WALLHAVEN_KEY and custom download directory, then saves edits with success feedback", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Wallhaven",
        effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
    });
    vi.mocked(saveSettings).mockResolvedValue({
      wallhavenKey: "updated-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Curated",
        effectiveDirectoryPath: "/Users/test/Pictures/Curated",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
    });

    render(<SettingsPage />);

    const wallhavenKeyInput = await screen.findByLabelText(/Wallhaven API key/i);
    const customDirectoryInput = screen.getByLabelText(/Custom download directory/i);

    expect(wallhavenKeyInput).toHaveValue("existing-key");
    expect(customDirectoryInput).toHaveValue("/Users/test/Pictures/Wallhaven");
    expect(screen.getByText("/Users/test/Pictures/Wallhaven")).toBeInTheDocument();
    expect(
      screen.getByText(
        "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
      ),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(wallhavenKeyInput);
    await user.type(wallhavenKeyInput, "updated-key");
    await user.clear(customDirectoryInput);
    await user.type(customDirectoryInput, "/Users/test/Pictures/Curated");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        wallhavenKey: "updated-key",
        customDownloadDirectoryPath: "/Users/test/Pictures/Curated",
      });
    });
    expect(await screen.findByText(/Settings saved/i)).toBeInTheDocument();
  });

  it("clears the custom directory field when switching back to the app default", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Wallhaven",
        effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
    });
    vi.mocked(saveSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "",
        effectiveDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: true,
      },
    });

    render(<SettingsPage />);

    const customDirectoryInput = await screen.findByLabelText(/Custom download directory/i);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /use app default directory/i }));

    expect(customDirectoryInput).toHaveValue("");
  });

  it("shows the backend validation message for invalid custom directory inputs", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "",
        effectiveDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: true,
      },
    });
    vi.mocked(saveSettings).mockRejectedValue(
      new SettingsCommandError({
        kind: "invalidRequest",
        message: "custom download directory must be an absolute path",
      }),
    );

    render(<SettingsPage />);

    const customDirectoryInput = await screen.findByLabelText(/Custom download directory/i);
    const user = userEvent.setup();
    await user.clear(customDirectoryInput);
    await user.type(customDirectoryInput, "relative/path");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByText(/custom download directory must be an absolute path/i)).toBeInTheDocument();
  });

  it("replaces loading summaries with unavailable copy when settings fail to load", async () => {
    vi.mocked(loadSettings).mockRejectedValue(new Error("Cannot read properties of undefined (reading 'invoke')"));

    render(<SettingsPage />);

    expect(
      await screen.findByText(/Cannot read properties of undefined \(reading 'invoke'\)/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable because settings failed to load")).toHaveLength(3);
    expect(screen.queryByText("Loading effective directory...")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading default directory...")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading saved mode...")).not.toBeInTheDocument();
  });
});
