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
    expect(screen.getByPlaceholderText("搜索关键词（支持标题、颜色、分辨率等）")).toBeInTheDocument();
    expect(screen.getByText("重新设计方案")).toBeInTheDocument();
    expect(screen.getByText("API 状态正常")).toBeInTheDocument();
  });
});
