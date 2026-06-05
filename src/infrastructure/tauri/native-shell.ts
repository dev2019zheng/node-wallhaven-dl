import { open } from "@tauri-apps/plugin-dialog"
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"

export const DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE =
  "This action needs the Tauri desktop runtime and is unavailable in the web preview."

export function isNativeShellAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export async function chooseDirectory(
  defaultPath?: string | null,
): Promise<string | null> {
  const selectedPath = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath ?? undefined,
    title: "Choose download directory",
  })

  return typeof selectedPath === "string" ? selectedPath : null
}

export async function revealPath(path: string): Promise<void> {
  await revealItemInDir(path)
}

export async function openNativePath(path: string): Promise<void> {
  await openPath(path)
}
