vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { listen } from "@tauri-apps/api/event";

import {
  DOWNLOAD_PROGRESS_EVENT,
  DOWNLOAD_STATUS_EVENT,
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
  type DownloadProgressEventPayload,
  type DownloadTaskStatusEventPayload,
} from "./download-events";

describe("download-events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("exposes stable download event names for status and progress streams", () => {
    expect(DOWNLOAD_STATUS_EVENT).toBe("downloads:status");
    expect(DOWNLOAD_PROGRESS_EVENT).toBe("downloads:progress");
  });

  it("registers status listeners against the shared status event name", async () => {
    const unlisten = vi.fn();
    const handler = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    await expect(listenForDownloadStatusEvents(handler)).resolves.toBe(unlisten);

    expect(listen).toHaveBeenCalledWith(DOWNLOAD_STATUS_EVENT, handler);
  });

  it("registers progress listeners with typed progress payloads", async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    const handler = vi.fn((event: { payload: DownloadProgressEventPayload }) => {
      expect(event.payload.downloadedBytes).toBe(1024);
      expect(event.payload.totalBytes).toBe(2048);
    });

    await listenForDownloadProgressEvents(handler);

    const registeredHandler = vi.mocked(listen).mock.calls[0]?.[1] as
      | ((event: { payload: DownloadProgressEventPayload }) => void)
      | undefined;

    registeredHandler?.({
      payload: {
        taskId: "download-000001",
        wallpaperId: "wh-1",
        fileName: "wh-1.jpg",
        downloadedBytes: 1024,
        totalBytes: 2048,
      },
    });

    expect(listen).toHaveBeenCalledWith(DOWNLOAD_PROGRESS_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("keeps status payloads aligned with Rust-side failure metadata", () => {
    const payload: DownloadTaskStatusEventPayload = {
      taskId: "download-000002",
      wallpaperId: "wh-2",
      fileName: "wh-2.jpg",
      relativeFilePath: "wallpapers/wh-2.jpg",
      status: "failed",
      failureReason: "503 Service Unavailable",
    };

    expect(payload.failureReason).toContain("503");
    expect(payload.status).toBe("failed");
  });
});
