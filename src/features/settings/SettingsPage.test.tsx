import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SettingsPage } from "./SettingsPage";

vi.mock("@/application/settings/settings-service", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

import { SettingsCommandError } from "@/application/settings/settings.types";
import { loadSettings, saveSettings } from "@/application/settings/settings-service";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

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
  });

  it("renders grouped cards for wallhaven access, download settings, and network controls", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
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
    });

    render(<SettingsPage />);

    expect(await screen.findByRole("region", { name: /wallhaven access/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /download settings/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /network/i })).toBeInTheDocument();
  });

  it("loads the saved WALLHAVEN_KEY, custom download directory, and proxy settings, then saves edits with success feedback", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
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
      networkProxy: {
        scheme: "http",
        address: "127.0.0.1:8899",
      },
    });

    render(<SettingsPage />);

    const wallhavenKeyInput = await screen.findByLabelText(/Wallhaven API key/i);
    const customDirectoryInput = screen.getByLabelText(/Custom download directory/i);
    const proxyTypeInput = screen.getByLabelText(/Proxy type/i);
    const proxyAddressInput = screen.getByLabelText(/Proxy address/i);

    expect(wallhavenKeyInput).toHaveValue("existing-key");
    expect(customDirectoryInput).toHaveValue("/Users/test/Pictures/Wallhaven");
    expect(proxyTypeInput).toHaveValue("socks5");
    expect(proxyAddressInput).toHaveValue("127.0.0.1:7897");
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
    await user.selectOptions(proxyTypeInput, "http");
    await user.clear(proxyAddressInput);
    await user.type(proxyAddressInput, "127.0.0.1:8899");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith({
        wallhavenKey: "updated-key",
        customDownloadDirectoryPath: "/Users/test/Pictures/Curated",
        networkProxyScheme: "http",
        networkProxyAddress: "127.0.0.1:8899",
      });
    });
    expect(await screen.findByText(/Settings saved/i)).toBeInTheDocument();
  });

  it("shows a store-backed status toast after settings save successfully", async () => {
    vi.mocked(loadSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Wallhaven",
        effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
      networkProxy: null,
    });
    vi.mocked(saveSettings).mockResolvedValue({
      wallhavenKey: "existing-key",
      downloadDirectory: {
        customDirectoryPath: "/Users/test/Pictures/Wallhaven",
        effectiveDirectoryPath: "/Users/test/Pictures/Wallhaven",
        defaultDirectoryPath:
          "/Users/test/Library/Application Support/cc.zhengyh.wallhaven.desktop/wallpapers",
        isUsingDefaultDirectory: false,
      },
      networkProxy: null,
    });

    render(
      <>
        <SettingsPage />
        <ToastProbe />
      </>,
    );

    await screen.findByLabelText(/Wallhaven API key/i);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Settings saved/i);
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
      networkProxy: null,
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
      networkProxy: null,
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
      networkProxy: null,
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

  it("shows the backend validation message for invalid proxy addresses", async () => {
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
      networkProxy: {
        scheme: "http",
        address: "127.0.0.1:7897",
      },
    });
    vi.mocked(saveSettings).mockRejectedValue(
      new SettingsCommandError({
        kind: "invalidRequest",
        message: "proxy address must not include a scheme",
      }),
    );

    render(<SettingsPage />);

    const proxyAddressInput = await screen.findByLabelText(/Proxy address/i);
    const user = userEvent.setup();
    await user.clear(proxyAddressInput);
    await user.type(proxyAddressInput, "http://127.0.0.1:7897");
    await user.click(screen.getByRole("button", { name: /save settings/i }));

    expect(await screen.findByText(/proxy address must not include a scheme/i)).toBeInTheDocument();
  });

  it("shows the shared storage error state and disables saving when settings fail to load", async () => {
    vi.mocked(loadSettings).mockRejectedValue(new Error("Cannot read properties of undefined (reading 'invoke')"));

    render(<SettingsPage />);

    expect(
      await screen.findByText(/Cannot read properties of undefined \(reading 'invoke'\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Storage details unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Settings failed to load, so storage information is unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading effective directory...")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading default directory...")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading saved mode...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save settings/i })).toBeDisabled();
  });
});
