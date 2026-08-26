export async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for WebViews or local test contexts where async clipboard is blocked.
    }
  }

  if (typeof document.execCommand !== "function") {
    throw new Error("Clipboard is unavailable.");
  }

  const textarea = document.createElement("textarea");
  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    if (!document.execCommand("copy")) {
      throw new Error("Clipboard is unavailable.");
    }
  } finally {
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();

      if (previousRange) {
        selection.addRange(previousRange);
      }
    }
  }
}
