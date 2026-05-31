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
  sourceUrl: string
  absolutePath: string
  purity?: "sfw" | "sketchy" | "nsfw"
  category?: "general" | "anime" | "people"
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
    sourceUrl: task.sourceUrl,
    fileName: task.target.fileName,
    relativeFilePath: task.target.relativeFilePath,
    absolutePath: task.absolutePath,
    status: task.status,
    failureReason: task.failureReason,
    purity: task.purity,
    category: task.category,
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

export async function deleteDownloadTask(taskId: string): Promise<void> {
  try {
    await invoke("delete_download_task", {
      request: {
        taskId,
      },
    })
  } catch (error) {
    throw toDownloadCommandError(error) as DownloadCommandError
  }
}
