import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeAccentProvider } from "./theme-accent-provider";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    document.documentElement.className = "";
    window.localStorage.clear();
  });

  it("toggles between dark and light themes", async () => {
    render(
      <ThemeProvider>
        <ThemeAccentProvider>
          <ThemeToggle />
        </ThemeAccentProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(document.documentElement.dataset.accent).toBe("ocean");
    });

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /switch to light theme/i }),
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("light");
    });

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });

    await user.click(screen.getByRole("radio", { name: /use sage accent/i }));

    await waitFor(() => {
      expect(document.documentElement.dataset.accent).toBe("sage");
      expect(window.localStorage.getItem("wallhaven-theme-accent")).toBe("sage");
    });
  });
});
