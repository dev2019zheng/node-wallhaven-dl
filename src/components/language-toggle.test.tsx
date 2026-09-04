import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { LanguageToggle } from "./language-toggle";
import { initI18n, setAppLocale } from "@/i18n";
import { LOCALE_STORAGE_KEY } from "@/i18n/locale-preference";
import { Sidebar } from "./sidebar";

describe("LanguageToggle", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await initI18n({ lng: "en" });
    await setAppLocale("en");
  });

  it("switches to Chinese and persists preference", async () => {
    render(
      <MemoryRouter initialEntries={["/search"]}>
        <LanguageToggle />
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /switch to chinese|切换到中文/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "搜索" })).toBeInTheDocument();
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh");
    });

    await user.click(screen.getByRole("button", { name: /switch to english|切换到英文/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    });
  });
});
