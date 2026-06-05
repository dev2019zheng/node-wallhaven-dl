import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeAccentProvider } from "./components/theme-accent-provider";
import { ThemeProvider } from "./components/theme-provider";
import App from "./App";

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.location.hash = "";
  });

  it("boots into the search page through the new desktop shell", async () => {
    render(
      <ThemeProvider>
        <ThemeAccentProvider>
          <App />
        </ThemeAccentProvider>
      </ThemeProvider>,
    );

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
    expect(screen.queryByText("Enterprise v3.0")).not.toBeInTheDocument();
    expect(screen.queryByText("zhengy")).not.toBeInTheDocument();
    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /Download queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it("keeps the top chrome menu scoped to real navigation commands", async () => {
    render(
      <ThemeProvider>
        <ThemeAccentProvider>
          <App />
        </ThemeAccentProvider>
      </ThemeProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Quick navigation" }));

    const menu = screen.getByRole("menu", { name: "Quick navigation commands" });
    expect(within(menu).getByRole("menuitem", { name: "Search" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Downloads" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Gallery" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: /Help commands/i })).not.toBeInTheDocument();
  });

  it("opens Downloads from the real queue summary in the sidebar", async () => {
    render(
      <ThemeProvider>
        <ThemeAccentProvider>
          <App />
        </ThemeAccentProvider>
      </ThemeProvider>,
    );

    const user = userEvent.setup();
    const sidebar = await screen.findByRole("complementary", { name: "sidebar" });
    await user.click(within(sidebar).getByRole("button", { name: /Download queue/i }));

    expect(await screen.findByRole("heading", { name: "Downloads" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#/downloads");
  });
});
