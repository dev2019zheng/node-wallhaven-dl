import { invoke } from "@tauri-apps/api/core"

import type {
  DownloadCommandError,
  DownloadRecord,
  DownloadTaskStatus,
  DownloadWallpaperInput,
} from "@/application/downloads/downloads.types"
import { toDownloadCommandError } from "@/application/downloads/downloads.types"

type DownloadTaskDto = {
  id: string
  wallpaperId: string
  target: {
    fileName: string
    relativeFilePath: string
  }
  status: DownloadTaskStatus
  failureReason?: string
}

function toDownloadRecord(task: DownloadTaskDto): DownloadRecord {
  return {
    id: task.id,
    wallpaperId: task.wallpaperId,
    fileName: task.target.fileName,
    relativeFilePath: task.target.relativeFilePath,
    status: task.status,
    failureReason: task.failureReason,
  }
}

export async function downloadWallpaper(
  request: DownloadWallpaperInput,
): Promise<DownloadRecord> {
  try {
    const task = await invoke<DownloadTaskDto>("download_wallpaper", {
      request,
    })

    return toDownloadRecord(task)
  } catch (error) {
    throw toDownloadCommandError(error) as DownloadCommandError
  }
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  try {
    const tasks = await invoke<DownloadTaskDto[]>("list_downloads")
    return tasks.map(toDownloadRecord)
  } catch (error) {
    throw toDownloadCommandError(error) as DownloadCommandError
  }
}
