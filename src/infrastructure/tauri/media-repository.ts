import { invoke } from "@tauri-apps/api/core"

type RemoteImageResponse = {
  bytes: number[]
  contentType: string
}

export async function loadRemoteImageObjectUrl(url: string): Promise<string> {
  const response = await invoke<RemoteImageResponse>("load_remote_image", {
    request: { url },
  })
  const blob = new Blob([new Uint8Array(response.bytes)], {
    type: response.contentType,
  })

  return URL.createObjectURL(blob)
}
