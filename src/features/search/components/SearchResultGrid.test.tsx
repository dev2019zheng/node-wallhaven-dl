vi.mock("yet-another-react-lightbox", () => ({
  default: ({ open, index, slides }: { open: boolean; index: number; slides: Array<{ src: string }> }) =>
    open ? <div data-testid="lightbox">{slides[index]?.src}</div> : null,
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SearchWallpaper } from "@/application/search/search.types";

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
  it("renders thumbnail cards with key metadata", () => {
    render(<SearchResultGrid wallpapers={wallpapers} />);

    expect(screen.getByRole("img", { name: /Wallpaper kxpkmm/i })).toHaveAttribute(
      "src",
      "https://th.wallhaven.cc/lg/kx/kxpkmm.jpg",
    );
    expect(screen.getByText("1966x3000")).toBeInTheDocument();
    expect(screen.getByText(/79 favorites/i)).toBeInTheDocument();
    expect(screen.getByText(/2572 views/i)).toBeInTheDocument();
  });

  it("opens a preview lightbox for the selected wallpaper", async () => {
    render(<SearchResultGrid wallpapers={wallpapers} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Preview wallpaper kxpkmm/i }));

    expect(screen.getByTestId("lightbox")).toHaveTextContent(
      "https://w.wallhaven.cc/full/kx/wallhaven-kxpkmm.jpg",
    );
  });
});
