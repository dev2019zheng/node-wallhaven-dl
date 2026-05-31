import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event";

export const DOWNLOAD_STATUS_EVENT = "downloads:status";
export const DOWNLOAD_PROGRESS_EVENT = "downloads:progress";

export type DownloadTaskStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped_existing";

export interface DownloadTaskStatusEventPayload {
  taskId: string;
  wallpaperId: string;
  fileName: string;
  relativeFilePath: string;
  status: DownloadTaskStatus;
  failureReason?: string;
}

export interface DownloadProgressEventPayload {
  taskId: string;
  wallpaperId: string;
  fileName: string;
  downloadedBytes: number;
  totalBytes?: number;
}

export function listenForDownloadStatusEvents(
  handler: EventCallback<DownloadTaskStatusEventPayload>,
): Promise<UnlistenFn> {
  return listen<DownloadTaskStatusEventPayload>(DOWNLOAD_STATUS_EVENT, handler);
}

export function listenForDownloadProgressEvents(
  handler: EventCallback<DownloadProgressEventPayload>,
): Promise<UnlistenFn> {
  return listen<DownloadProgressEventPayload>(DOWNLOAD_PROGRESS_EVENT, handler);
}
