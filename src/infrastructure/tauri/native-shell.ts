import { open } from "@tauri-apps/plugin-dialog"
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"

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
