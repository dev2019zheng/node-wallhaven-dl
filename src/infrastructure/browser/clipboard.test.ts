import { writeClipboardText } from "./clipboard";

describe("writeClipboardText", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = undefined as unknown as typeof document.execCommand;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    document.execCommand = originalExecCommand;
  });

  it("uses the async clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await writeClipboardText("wallhaven-link");

    expect(writeText).toHaveBeenCalledWith("wallhaven-link");
  });

  it("falls back to execCommand copy when async clipboard is unavailable", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand as typeof document.execCommand;

    await writeClipboardText("fallback-link");

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).not.toBeInTheDocument();
  });

  it("clears the temporary textarea selection after fallback copy", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand as typeof document.execCommand;

    await writeClipboardText("fallback-link");

    expect(document.getSelection()?.rangeCount).toBe(0);
  });

  it("throws a clear error when no clipboard path is available", async () => {
    await expect(writeClipboardText("missing-clipboard")).rejects.toThrow("Clipboard is unavailable.");
  });
});
