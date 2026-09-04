import { describe, expect, it } from "vitest"

import {
  DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE,
  isDesktopRuntimeUnavailableError,
  toUserFacingErrorMessage,
} from "./runtime-errors"

describe("desktop runtime error mapping", () => {
  it("detects invoke TypeErrors from missing Tauri bridge", () => {
    expect(
      isDesktopRuntimeUnavailableError(
        new Error("Cannot read properties of undefined (reading 'invoke')"),
      ),
    ).toBe(true)
  })

  it("maps desktop-unavailable errors to the shared friendly message", () => {
    expect(
      toUserFacingErrorMessage(
        new Error("Cannot read properties of undefined (reading 'invoke')"),
        "Search failed.",
      ),
    ).toBe(DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE)
  })

  it("keeps unrelated errors intact", () => {
    expect(toUserFacingErrorMessage(new Error("503 Service Unavailable"), "Fallback")).toBe(
      "503 Service Unavailable",
    )
    expect(toUserFacingErrorMessage("plain string failure", "Fallback")).toBe("plain string failure")
    expect(toUserFacingErrorMessage(null, "Fallback")).toBe("Fallback")
  })
})
