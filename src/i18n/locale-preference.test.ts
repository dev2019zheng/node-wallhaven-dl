import {
  detectNavigatorLocale,
  isAppLocale,
  readStoredLocale,
  resolveInitialLocale,
  toggleLocale,
  writeStoredLocale,
  LOCALE_STORAGE_KEY,
} from "./locale-preference";

describe("locale-preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("validates locales and toggles en ↔ zh", () => {
    expect(isAppLocale("en")).toBe(true);
    expect(isAppLocale("zh")).toBe(true);
    expect(isAppLocale("fr")).toBe(false);
    expect(toggleLocale("en")).toBe("zh");
    expect(toggleLocale("zh-CN")).toBe("en");
  });

  it("persists preference in localStorage", () => {
    writeStoredLocale("zh");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh");
    expect(readStoredLocale()).toBe("zh");
    expect(resolveInitialLocale()).toBe("zh");
  });

  it("falls back to navigator language when unset", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "zh-CN",
    });
    expect(detectNavigatorLocale()).toBe("zh");
    expect(resolveInitialLocale()).toBe("zh");
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => original,
    });
  });
});
