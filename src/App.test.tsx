import { render, screen, waitFor, within } from "@testing-library/react";

import App from "./App";

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.location.hash = "";
  });

  it("boots into the search page through the new desktop shell", async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
      expect(window.location.hash).toBe("#/search");
    });

    const sidebar = await screen.findByRole("complementary", { name: "sidebar" });
    const topBar = screen.getByRole("banner", { name: "top bar" });
    const searchLink = within(sidebar).getByRole("link", { name: "Search" });

    expect(topBar).toBeInTheDocument();
    expect(searchLink).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("heading", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("Enterprise v3.0")).toBeInTheDocument();
    expect(screen.getByText("API synced")).toBeInTheDocument();
  });
});
