import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { loadSettings, saveSettings } from "@/application/settings/settings-service";
import type { SettingsSnapshot } from "@/application/settings/settings.types";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

import { SettingsPage } from "./SettingsPage";

const { chooseDirectory, revealPath } = vi.hoisted(() => ({
  chooseDirectory: vi.fn(),
  revealPath: vi.fn(),
}));

vi.mock("@/application/settings/settings-service", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/infrastructure/tauri/native-shell", () => ({
  chooseDirectory,
  revealPath,
}));

const preferences = {
  launchAtLogin: false,
  confirmBeforeDelete: true,
  telemetryEnabled: false,
  cacheSizeBytes: 38_400_000,
};

const defaultSnapshot: SettingsSnapshot = {
  wallhavenKey: "existing-key",
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
};

function ToastProbe() {
  const toasts = useUiShellStore((state) => state.toasts);

  return (
    <>
      {toasts.map((toast) => (
        <div key={toast.id} role={toast.tone === "error" ? "alert" : "status"}>
          {toast.title}
        </div>
      ))}
    </>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useUiShellStore.setState({ toasts: [], confirm: null });
    vi.mocked(loadSettings).mockResolvedValue(defaultSnapshot);
    vi.mocked(saveSettings).mockResolvedValue(defaultSnapshot);
    vi.mocked(chooseDirectory).mockResolvedValue(null);
    vi.mocked(revealPath).mockResolvedValue(undefined);
  });

  it("renders the v3 settings sections and effective destination panel", async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole("region", { name: /wallhaven access/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /download directory/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /network proxy/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /advanced/i })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /effective destination/i })).toBeInTheDocument();
  });

  it("loads saved key, destination, proxy, and toggles into custom controls", async () => {
    render(<SettingsPage />);

    expect(await screen.findByLabelText(/^API Key$/i, { selector: "input" })).toHaveValue("existing-key");
    expect(screen.getByLabelText(/Download path/i)).toHaveValue("/Users/test/Pictures/Wallhaven");
    expect(screen.getByLabelText(/Proxy address/i)).toHaveValue("127.0.0.1:7897");
    expect(screen.getByRole("button", { name: /SOCKS5/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: /Ask before deleting/i })).toHaveAttribute("aria-checked", "true");
  });

  it("saves edited settings with store-backed preferences and success feedback", async () => {
    vi.mocked(saveSettings).mockResolvedValue({
      ...defaultSnapshot,
      wallhavenKey: "updated-key",
      downloadDirectory: {
        ...defaultSnapshot.downloadDirectory,
        customDirectoryPath: "/Users/test/Pictures/Curated",
        effectiveDirectoryPath: "/Users/test/Pictures/Curated",
      },
      networkProxy: {
        scheme: "http",
        address: "127.0.0.1:8899",
      },
      preferences: {
        ...preferences,
        launchAtLogin: true,
      },
    });

    render(
      <>
        <SettingsPage />
        <ToastProbe />
      </>,
    );

    const user = userEvent.setup();
    const wallhavenKeyInput = await screen.findByLabelText(/^API Key$/i, { selector: "input" });
    const customDirectoryInput = screen.getByLabelText(/Download path/i);
    const proxyAddressInput = screen.getByLabelText(/Proxy address/i);

    await user.clear(wallhavenKeyInput);
    await user.type(wallhavenKeyInput, "updated-key");
    await user.clear(customDirectoryInput);
    await user.type(customDirectoryInput, "/Users/test/Pictures/Curated");
    await user.click(screen.getByRole("button", { name: /^HTTP$/i }));
    await user.clear(proxyAddressInput);
    await user.type(proxyAddressInput, "127.0.0.1:8899");
    await user.click(screen.getByRole("switch", { name: /Launch at login/i }));
    await user.click(screen.getByRole("button", { name: /Save settings/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        wallhavenKey: "updated-key",
        customDownloadDirectoryPath: "/Users/test/Pictures/Curated",
        networkProxyScheme: "http",
        networkProxyAddress: "127.0.0.1:8899",
        preferences: {
          ...preferences,
          launchAtLogin: true,
        },
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/Settings saved/i);
  });

  it("updates the effective destination summary and marks unsaved changes while editing", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      ...defaultSnapshot,
      downloadDirectory: {
        ...defaultSnapshot.downloadDirectory,
        customDirectoryPath: "",
        effectiveDirectoryPath: defaultSnapshot.downloadDirectory.defaultDirectoryPath,
        isUsingDefaultDirectory: true,
      },
      networkProxy: null,
    });

    render(<SettingsPage />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Download path/i), "/Users/test/Pictures/Curated");
    await user.type(screen.getByLabelText(/Proxy address/i), "127.0.0.1:7897");

    expect(screen.getAllByText("Unsaved changes").length).toBeGreaterThan(0);
    expect(screen.getByText("/Users/test/Pictures/Curated")).toBeInTheDocument();
    expect(screen.getByText("Custom directory")).toBeInTheDocument();
    expect(screen.getByText("HTTP · 127.0.0.1:7897")).toBeInTheDocument();
  });

  it("uses the native directory picker to populate the download path field", async () => {
    vi.mocked(chooseDirectory).mockResolvedValue("/Users/test/Pictures/Chosen");

    render(<SettingsPage />);

    const user = userEvent.setup();
    await screen.findByLabelText(/^API Key$/i, { selector: "input" });
    await user.click(screen.getByRole("button", { name: /^Choose$/i }));

    expect(chooseDirectory).toHaveBeenCalledWith("/Users/test/Pictures/Wallhaven");
    expect(screen.getByLabelText(/Download path/i)).toHaveValue("/Users/test/Pictures/Chosen");
  });

  it("reveals the effective destination through the native shell bridge", async () => {
    render(<SettingsPage />);

    const user = userEvent.setup();
    await screen.findByLabelText(/^API Key$/i, { selector: "input" });
    await user.click(screen.getByRole("button", { name: /^Reveal$/i }));

    expect(revealPath).toHaveBeenCalledWith("/Users/test/Pictures/Wallhaven");
  });

  it("validates masked API key input and reports success without exposing logs", async () => {
    render(
      <>
        <SettingsPage />
        <ToastProbe />
      </>,
    );

    const user = userEvent.setup();
    await screen.findByLabelText(/^API Key$/i, { selector: "input" });
    await user.click(screen.getByRole("button", { name: /Validate key/i }));

    expect((await screen.findAllByText(/API key validated/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("status")).toHaveTextContent(/API key validated/i);
  });

  it("blocks saving invalid directory and proxy values near the controls", async () => {
    render(<SettingsPage />);

    const user = userEvent.setup();
    await user.clear(await screen.findByLabelText(/Download path/i));
    await user.type(screen.getByLabelText(/Download path/i), "relative/path");
    await user.clear(screen.getByLabelText(/Proxy address/i));
    await user.type(screen.getByLabelText(/Proxy address/i), "http://127.0.0.1:7897");

    expect(screen.getByText(/Folder does not exist or is not writable/i)).toBeInTheDocument();
    expect(screen.getByText(/Proxy address must be host:port/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save settings/i })).toBeDisabled();
  });

  it("clears cache through the confirmation dialog without deleting originals", async () => {
    render(
      <>
        <SettingsPage />
        <ConfirmDialog />
      </>,
    );

    const user = userEvent.setup();
    await screen.findByLabelText(/^API Key$/i, { selector: "input" });
    await user.click(screen.getByRole("button", { name: /Clear cache/i }));

    expect(screen.getByRole("dialog", { name: /Clear cache/i })).toBeInTheDocument();
    expect(screen.getByText(/Downloaded wallpaper originals stay in place/i)).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: /Clear cache/i })).getByRole("button", { name: /^Clear cache$/i }));

    expect(await screen.findByText(/0 MB · cleaning never removes downloaded wallpaper originals/i)).toBeInTheDocument();
  });

  it("shows the shared storage error state and disables saving when settings fail to load", async () => {
    vi.mocked(loadSettings).mockRejectedValue(new Error("Cannot read properties of undefined (reading 'invoke')"));

    render(<SettingsPage />);

    expect(
      await screen.findByText(/Cannot read properties of undefined \(reading 'invoke'\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Storage unavailable")).toBeInTheDocument();
    expect(screen.getByText("Settings failed to load, so storage summary is unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save settings/i })).toBeDisabled();
  });
});
