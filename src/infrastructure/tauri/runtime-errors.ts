export const DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE =
  "Desktop runtime unavailable. Open the Tauri desktop app to use this feature."

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return ""
}

export function isDesktopRuntimeUnavailableError(error: unknown): boolean {
  const message = getRawErrorMessage(error)

  if (!message) {
    return false
  }

  const normalized = message.toLowerCase()

  return (
    message.includes("Cannot read properties of undefined (reading 'invoke')") ||
    message.includes("Cannot read properties of undefined (reading 'transformCallback')") ||
    message.includes("__TAURI_INTERNALS__") ||
    (message.includes("Tauri") && normalized.includes("not available"))
  )
}

/**
 * Maps known desktop/Tauri-unavailable failures to a stable user-facing message.
 * Other errors keep their original message (or the provided fallback).
 */
export function toUserFacingErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isDesktopRuntimeUnavailableError(error)) {
    return DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE
  }

  const message = getRawErrorMessage(error)
  return message || fallbackMessage
}
