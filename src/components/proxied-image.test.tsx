vi.mock("@/infrastructure/tauri/media-repository", () => ({
  loadRemoteImageObjectUrl: vi.fn(),
}));

import { render, screen, waitFor } from "@testing-library/react";

import { loadRemoteImageObjectUrl } from "@/infrastructure/tauri/media-repository";

import { ProxiedImage } from "./proxied-image";

describe("ProxiedImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("does not expose the remote image URL while the proxy load is pending", () => {
    vi.mocked(loadRemoteImageObjectUrl).mockReturnValue(new Promise(() => undefined));

    render(<ProxiedImage alt="wallpaper" src="https://th.wallhaven.cc/lg/kx/kxpkmm.jpg" />);

    expect(screen.getByRole("img", { name: "wallpaper" }).getAttribute("src")).toMatch(
      /^data:image\/svg\+xml/,
    );
    expect(loadRemoteImageObjectUrl).toHaveBeenCalledWith(
      "https://th.wallhaven.cc/lg/kx/kxpkmm.jpg",
    );
  });

  it("renders the object URL returned by the Tauri proxy loader", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockResolvedValue("blob://proxied-wallpaper");

    render(<ProxiedImage alt="wallpaper" src="https://th.wallhaven.cc/lg/kx/kxpkmm.jpg" />);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "wallpaper" })).toHaveAttribute(
        "src",
        "blob://proxied-wallpaper",
      );
    });
  });

  it("keeps a non-broken placeholder when proxy loading fails", async () => {
    vi.mocked(loadRemoteImageObjectUrl).mockRejectedValue(new Error("network unavailable"));

    render(<ProxiedImage alt="wallpaper" src="https://th.wallhaven.cc/lg/kx/kxpkmm.jpg" />);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "wallpaper" })).toHaveAttribute(
        "data-load-state",
        "error",
      );
    });
    expect(screen.getByRole("img", { name: "wallpaper" }).getAttribute("src")).toMatch(
      /^data:image\/svg\+xml/,
    );
  });
});
