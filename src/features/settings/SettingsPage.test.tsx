import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsPage } from "./SettingsPage";

vi.mock("@/application/settings/settings-service", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

import { loadSettings, saveSettings } from "@/application/settings/settings-service";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the saved WALLHAVEN_KEY and saves edits with success feedback", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      defaultDownloadStrategy: {
        baseDir: "AppLocalData",
        relativePath: "wallpapers",
      },
    });
    vi.mocked(saveSettings).mockResolvedValue(undefined);

    render(<SettingsPage />);

    const input = await screen.findByLabelText(/Wallhaven API key/i);
    expect(input).toHaveValue("existing-key");
    expect(screen.getByText("AppLocalData/wallpapers")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "updated-key");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({ wallhavenKey: "updated-key" });
    });
    expect(await screen.findByText(/Settings saved/i)).toBeInTheDocument();
  });
});
