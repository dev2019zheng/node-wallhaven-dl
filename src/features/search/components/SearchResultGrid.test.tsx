vi.mock("yet-another-react-lightbox", () => ({
  default: ({ open, index, slides }: { open: boolean; index: number; slides: Array<{ src: string }> }) =>
    open ? <div data-testid="lightbox">{slides[index]?.src}</div> : null,
}));

vi.mock("@/infrastructure/tauri/media-repository", () => ({
  loadRemoteImageObjectUrl: vi.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SearchWallpaper } from "@/application/search/search.types";
import { loadRemoteImageObjectUrl } from "@/infrastructure/tauri/media-repository";

import { SearchResultGrid } from "./SearchResultGrid";

const wallpapers: SearchWallpaper[] = [
  {
    id: "kxpkmm",
    url: "https://wallhaven.cc/w/kxpkmm",
    shortUrl: "https://whvn.cc/kxpkmm",
    views: 2572,
    favorites: 79,
    source: "https://x.com/sciamano240/status/1870129953464815847",
    purity: "sfw",
    category: "anime",
    dimensionX: 1966,
    dimensionY: 3000,
    resolution: "1966x3000",
    ratio: "0.66",
    fileSize: 3088002,
    fileType: "image/jpeg",
    createdAt: "2025-01-31 00:21:26",
    colors: ["#cccccc"],
    path: "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
    thumbs: {
      large: "https://th.wallhaven.cc/lg/kx/kxpkmm.jpg",
      original: "https://th.wallhaven.cc/orig/kx/kxpkmm.jpg",
      small: "https://th.wallhaven.cc/small/kx/kxpkmm.jpg",
    },
  },
];

describe("SearchResultGrid", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders thumbnail cards with key metadata through the proxy loader", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockResolvedValue("blob://proxied-thumbnail");

    render(<SearchResultGrid wallpapers={wallpapers} />);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /Wallpaper kxpkmm/i })).toHaveAttribute(
        "src",
        "blob://proxied-thumbnail",
      );
    });
    expect(loadRemoteImageObjectUrl).toHaveBeenCalledWith("https://th.wallhaven.cc/lg/kx/kxpkmm.jpg");
    expect(screen.getByText("1966x3000")).toBeInTheDocument();
    expect(screen.getByText("79")).toBeInTheDocument();
    expect(screen.getByText("2572")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("Views")).toBeInTheDocument();
  });

  it("opens a preview lightbox for the selected wallpaper", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockResolvedValue("blob://proxied-thumbnail");

    render(<SearchResultGrid wallpapers={wallpapers} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Preview wallpaper kxpkmm/i }));

    expect(screen.getByTestId("lightbox")).toHaveTextContent(
      "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
    );
    expect(
      screen.getByRole("link", { name: /Open Wallhaven page for wallpaper kxpkmm/i }),
    ).toHaveAttribute("href", "https://wallhaven.cc/w/kxpkmm");
  });

  it("opens a preview from the card metadata area", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockResolvedValue("blob://proxied-thumbnail");

    render(<SearchResultGrid wallpapers={wallpapers} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Open card details for wallpaper kxpkmm/i }));

    expect(screen.getByRole("dialog", { name: /Preview wallpaper kxpkmm/i })).toBeInTheDocument();
  });

  it("closes the preview from escape and image backdrop clicks", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockResolvedValue("blob://proxied-thumbnail");

    render(<SearchResultGrid wallpapers={wallpapers} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Preview wallpaper kxpkmm/i }));

    expect(screen.getByRole("dialog", { name: /Preview wallpaper kxpkmm/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: /Preview wallpaper kxpkmm/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Preview wallpaper kxpkmm/i }));
    fireEvent.mouseDown(screen.getByTestId("lightbox-image-backdrop"));

    expect(screen.queryByRole("dialog", { name: /Preview wallpaper kxpkmm/i })).not.toBeInTheDocument();
  });
});
