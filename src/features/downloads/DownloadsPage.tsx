import { FolderOpen, Radio, RefreshCcw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  applyDownloadProgressEvent,
  applyDownloadStatusEvent,
  deleteDownloadTask as deleteDownloadTaskInService,
  downloadWallpaper as downloadWallpaperInService,
  filterDownloads,
  listDownloads as listDownloadsInService,
  mergeLoadedDownloads,
  summarizeDownloads,
  type DownloadQueueFilter,
} from "@/application/downloads/downloads-service"
import type { DownloadListItem } from "@/application/downloads/downloads.types"
import {
  loadDownloadDirectory,
  loadSettingsPreferences,
} from "@/application/settings/settings-service"
import { ErrorState } from "@/components/error-state"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { useUiShellStore } from "@/features/shell/ui-shell-store"
import { writeClipboardText } from "@/infrastructure/browser/clipboard"
import {
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
} from "@/infrastructure/tauri/download-events"
import {
  DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE,
  isNativeShellAvailable,
  openNativePath,
} from "@/infrastructure/tauri/native-shell"

import { DownloadQueue } from "./components/DownloadQueue"
import { QueueTabs } from "./components/QueueTabs"

type PendingTaskAction = "copy" | "delete" | "primary"
type LiveEventTone = "info" | "ok" | "warn" | "bad"

type LiveEventItem = {
  id: string
  tone: LiveEventTone
  message: string
  timestamp: string
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function getParentDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/")
  const lastSeparatorIndex = normalizedPath.lastIndexOf("/")

  if (lastSeparatorIndex <= 0) {
    return path
  }

  return normalizedPath.slice(0, lastSeparatorIndex)
}

function appendLiveEvent(currentEvents: LiveEventItem[], nextEvent: LiveEventItem): LiveEventItem[] {
  return [nextEvent, ...currentEvents].slice(0, 300)
}

function getEventTimestamp(): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function summarizeTransferProgress(
  downloads: DownloadListItem[],
  summary: ReturnType<typeof summarizeDownloads>,
): {
  primary: string
  secondary: string
  progressPercent: number
} {
  const downloadedBytes = downloads.reduce((total, download) => total + download.downloadedBytes, 0)
  const knownTotalBytes = downloads.reduce((total, download) => total + (download.totalBytes ?? 0), 0)
  const progressPercent =
    knownTotalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / knownTotalBytes) * 100)) : 0
  const primary =
    knownTotalBytes > 0
      ? `${formatBytes(downloadedBytes)} / ${formatBytes(knownTotalBytes)}`
      : downloadedBytes > 0
        ? `${formatBytes(downloadedBytes)} received`
        : `${summary.activeCount} active transfers`
  const secondary =
    summary.activeCount > 0
      ? `${summary.runningCount} running · ${summary.queuedCount} queued`
      : summary.totalCount > 0
        ? `${summary.completedCount} complete · ${summary.failedCount} failed`
        : "No transfer activity yet"

  return {
    primary,
    secondary,
    progressPercent,
  }
}

export function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadListItem[]>([])
  const [activeFilter, setActiveFilter] = useState<DownloadQueueFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([])
  const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true)
  const [isOpeningFolder, setIsOpeningFolder] = useState(false)
  const [pendingActionByTaskId, setPendingActionByTaskId] = useState<Record<string, PendingTaskAction | null>>({})
  const setDownloadSummary = useUiShellStore((state) => state.setDownloadSummary)
  const enqueueToast = useUiShellStore((state) => state.enqueueToast)
  const setConfirm = useUiShellStore((state) => state.setConfirm)
  const canUseNativeShell = isNativeShellAvailable()

  useEffect(() => {
    let isActive = true
    let unlistenStatus: (() => void) | undefined
    let unlistenProgress: (() => void) | undefined

    const start = async () => {
      setIsLoading(true)

      try {
        const listenerErrors: string[] = []
        let nextUnlistenStatus: (() => void) | undefined
        let nextUnlistenProgress: (() => void) | undefined

        try {
          nextUnlistenStatus = await listenForDownloadStatusEvents((event) => {
            if (!isActive) {
              return
            }

            setDownloads((currentDownloads) =>
              applyDownloadStatusEvent(currentDownloads, event.payload),
            )
            setLiveEvents((currentEvents) =>
              appendLiveEvent(currentEvents, {
                id: `${event.payload.taskId}-${event.payload.status}`,
                tone:
                  event.payload.status === "failed"
                    ? "bad"
                    : event.payload.status === "succeeded" || event.payload.status === "skipped_existing"
                      ? "ok"
                      : event.payload.status === "queued"
                        ? "info"
                        : "info",
                message:
                  event.payload.status === "queued"
                    ? `已加入队列 · ${event.payload.fileName}`
                    : event.payload.status === "running"
                      ? `开始下载 · ${event.payload.fileName}`
                      : event.payload.status === "succeeded"
                        ? `任务完成 · ${event.payload.fileName}`
                        : event.payload.status === "skipped_existing"
                          ? `已跳过重复文件 · ${event.payload.fileName}`
                          : `下载失败 · ${event.payload.fileName}`,
                timestamp: getEventTimestamp(),
              }),
            )
          })
        } catch (error) {
          listenerErrors.push(getErrorMessage(error, "Unable to subscribe to download status events."))
        }

        try {
          nextUnlistenProgress = await listenForDownloadProgressEvents((event) => {
            if (!isActive) {
              return
            }

            setDownloads((currentDownloads) =>
              applyDownloadProgressEvent(currentDownloads, event.payload),
            )
            const progressPercent =
              event.payload.totalBytes && event.payload.totalBytes > 0
                ? Math.min(100, Math.round((event.payload.downloadedBytes / event.payload.totalBytes) * 100))
                : null
            setLiveEvents((currentEvents) =>
              appendLiveEvent(currentEvents, {
                id: `${event.payload.taskId}-progress-${event.payload.downloadedBytes}`,
                tone: "info",
                message:
                  progressPercent === null
                    ? `下载进度 · ${event.payload.fileName}`
                    : `下载进度 · ${event.payload.fileName} · ${progressPercent}%`,
                timestamp: getEventTimestamp(),
              }),
            )
          })
        } catch (error) {
          listenerErrors.push(getErrorMessage(error, "Unable to subscribe to download progress events."))
        }

        if (!isActive) {
          nextUnlistenStatus?.()
          nextUnlistenProgress?.()
          return
        }

        unlistenStatus = nextUnlistenStatus
        unlistenProgress = nextUnlistenProgress

        if (listenerErrors.length > 0) {
          setLiveEvents((currentEvents) =>
            appendLiveEvent(currentEvents, {
              id: `download-event-stream-unavailable-${Date.now()}`,
              tone: "warn",
              message:
                listenerErrors.length > 1
                  ? "Live event stream unavailable. Use Refresh to reload task snapshots."
                  : "Live event stream partially unavailable. Use Refresh to reload task snapshots.",
              timestamp: getEventTimestamp(),
            }),
          )
        }

        const loadedDownloads = await listDownloadsInService()
        if (!isActive) {
          return
        }

        setDownloads((currentDownloads) =>
          mergeLoadedDownloads(currentDownloads, loadedDownloads),
        )
        setLoadError(null)
      } catch (error) {
        if (!isActive) {
          return
        }

        setLoadError(getErrorMessage(error, "Failed to initialize downloads."))
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void start()
    void loadSettingsPreferences()
      .then((preferences) => {
        if (isActive) {
          setConfirmBeforeDelete(preferences.confirmBeforeDelete)
        }
      })
      .catch(() => {
        // Keep the safe default when preferences are unavailable.
      })

    return () => {
      isActive = false
      unlistenStatus?.()
      unlistenProgress?.()
    }
  }, [])

  const summary = useMemo(() => summarizeDownloads(downloads), [downloads])
  const transferProgress = useMemo(
    () => summarizeTransferProgress(downloads, summary),
    [downloads, summary],
  )
  const filteredDownloads = useMemo(
    () => filterDownloads(downloads, activeFilter),
    [activeFilter, downloads],
  )

  useEffect(() => {
    setDownloadSummary({
      activeCount: summary.activeCount,
      completedCount: summary.completedCount,
      failedCount: summary.failedCount,
    })
  }, [setDownloadSummary, summary.activeCount, summary.completedCount, summary.failedCount])

  const showToast = (
    title: string,
    description: string,
    tone: "error" | "info" | "success" = "success",
  ) => {
    enqueueToast({
      id: `downloads-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description,
      tone,
    })
  }

  const setPendingTaskAction = (taskId: string, action: PendingTaskAction | null) => {
    setPendingActionByTaskId((currentActions) => {
      if (action === null) {
        const nextActions = { ...currentActions }
        delete nextActions[taskId]
        return nextActions
      }

      return {
        ...currentActions,
        [taskId]: action,
      }
    })
  }

  const handleOpenFolder = async () => {
    if (!canUseNativeShell) {
      showToast("Desktop runtime unavailable", DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE, "info")
      return
    }

    setIsOpeningFolder(true)

    try {
      const downloadDirectory = await loadDownloadDirectory()
      await openNativePath(downloadDirectory.effectiveDirectoryPath)
    } catch (error) {
      showToast("Open folder failed", getErrorMessage(error, "Unable to open the download directory."), "error")
    } finally {
      setIsOpeningFolder(false)
    }
  }

  const refreshDownloads = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const loadedDownloads = await listDownloadsInService()
      setDownloads((currentDownloads) =>
        mergeLoadedDownloads(currentDownloads, loadedDownloads),
      )
      showToast("Queue refreshed", `${loadedDownloads.length} tasks loaded.`, "info")
    } catch (error) {
      setLoadError(getErrorMessage(error, "Failed to refresh downloads."))
      showToast("Refresh failed", getErrorMessage(error, "Unable to reload download tasks."), "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrimaryAction = async (download: DownloadListItem) => {
    if (download.status !== "failed" && !canUseNativeShell) {
      showToast("Desktop runtime unavailable", DESKTOP_RUNTIME_UNAVAILABLE_MESSAGE, "info")
      return
    }

    setPendingTaskAction(download.id, "primary")

    try {
      if (download.status === "failed") {
        if (!download.sourceUrl) {
          throw new Error("Original download URL is not available for retry.")
        }

        await downloadWallpaperInService({
          wallpaperId: download.wallpaperId,
          imageUrl: download.sourceUrl,
          fileName: download.fileName,
          purity: download.purity,
          category: download.category,
        })
        showToast("Retry queued", download.fileName)
        return
      }

      if (!download.absolutePath) {
        throw new Error("Task path is not available yet.")
      }

      if (download.status === "succeeded" || download.status === "skipped_existing") {
        await openNativePath(download.absolutePath)
        return
      }

      await openNativePath(getParentDirectory(download.absolutePath))
    } catch (error) {
      showToast("Task action failed", getErrorMessage(error, "Unable to open the selected download."), "error")
    } finally {
      setPendingTaskAction(download.id, null)
    }
  }

  const handleCopyPath = async (download: DownloadListItem) => {
    setPendingTaskAction(download.id, "copy")

    try {
      if (!download.absolutePath) {
        throw new Error("Task path is not available yet.")
      }

      await writeClipboardText(download.absolutePath)
      showToast("Path copied", download.absolutePath)
    } catch (error) {
      showToast("Copy failed", getErrorMessage(error, "Clipboard is unavailable."), "error")
    } finally {
      setPendingTaskAction(download.id, null)
    }
  }

  const deleteTask = async (download: DownloadListItem) => {
    setPendingTaskAction(download.id, "delete")

    try {
      await deleteDownloadTaskInService(download.id)
      setDownloads((currentDownloads) =>
        currentDownloads.filter((currentDownload) => currentDownload.id !== download.id),
      )
      showToast("Task deleted", download.fileName)
    } catch (error) {
      showToast("Delete failed", getErrorMessage(error, "Unable to delete the download task."), "error")
    } finally {
      setPendingTaskAction(download.id, null)
    }
  }

  const handleDelete = (download: DownloadListItem) => {
    if (download.status === "queued" || download.status === "running") {
      return
    }

    const description =
      download.status === "failed"
        ? `This removes the failed task record for ${download.fileName}.`
        : `This removes ${download.fileName} from disk, task history, and the local gallery archive.`

    if (!confirmBeforeDelete) {
      void deleteTask(download)
      return
    }

    setConfirm({
      title: "Delete download task?",
      description,
      confirmLabel: "Delete task",
      onConfirm: () => {
        void deleteTask(download)
      },
    })
  }
  const headingBadge = isLoading
    ? { label: "Loading queue", tone: "info" as const }
    : loadError
      ? { label: "Queue unavailable", tone: "error" as const }
      : summary.activeCount > 0
        ? { label: "Transfers active", tone: "success" as const }
        : { label: "Queue ready", tone: "info" as const }

  return (
    <section className="space-y-6">
      <PageHeading
        badge={headingBadge.label}
        badgeTone={headingBadge.tone}
        description="Track queued, running, completed and failed transfers."
        eyebrow="Wallpaper transfer queue"
        title="Downloads"
      />

      <section className="wh-dense-bento grid grid-cols-1 items-start gap-6 xl:grid-cols-[240px_minmax(0,1fr)] min-[1500px]:grid-cols-[260px_minmax(0,1fr)_260px]">
        <aside className="app-panel space-y-6 p-6 min-[1500px]:h-[698px]">
          <div className="space-y-2">
            <h3 className="text-[20px] font-semibold leading-7 text-foreground">Command Center</h3>
            <p className="text-[13px] font-medium text-muted-foreground">Queue health</p>
          </div>

          <dl className="grid gap-[18px]">
            <div className="wh-kinetic-card h-[62px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Queued</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-foreground">{summary.queuedCount}</dd>
            </div>
            <div className="wh-kinetic-card h-[62px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Running</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-primary">{summary.runningCount}</dd>
            </div>
            <div className="wh-kinetic-card h-[62px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Completed</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-emerald-400">{summary.completedCount}</dd>
            </div>
            <div className="wh-kinetic-card h-[62px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Failed</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-destructive">{summary.failedCount}</dd>
            </div>
          </dl>

          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-foreground">Progress</p>
            <div className="wh-kinetic-card h-[120px] rounded-[18px] border border-border bg-[var(--surface-deep)] p-4">
              <div className="truncate text-[22px] font-bold text-foreground">{transferProgress.primary}</div>
              <div className="mt-1 text-[13px] font-medium text-muted-foreground">{transferProgress.secondary}</div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${transferProgress.progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] font-medium text-muted-foreground">
                {transferProgress.progressPercent > 0 ? `${transferProgress.progressPercent}% of known bytes` : "Waiting for byte progress"}
              </p>
            </div>
          </div>

          <Button
            className="h-12 w-full rounded-[14px]"
            disabled={isOpeningFolder || !canUseNativeShell}
            onClick={() => {
              void handleOpenFolder()
            }}
            type="button"
          >
            <FolderOpen className="h-4 w-4" />
            {isOpeningFolder ? "Opening..." : "Open folder"}
          </Button>
          {!canUseNativeShell ? (
            <p className="text-[12px] leading-5 text-muted-foreground">
              Local folder and file opening is available in the desktop app.
            </p>
          ) : null}
        </aside>

        <section className="app-panel min-h-[520px] space-y-6 p-6 min-[1500px]:h-[698px]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-[20px] font-semibold leading-7 text-foreground">Tasks</h3>
              <p className="sr-only">
                进入页面后先拉取已有任务，再持续接收状态与进度事件。
              </p>
            </div>
            <Button
              className="h-10 rounded-[14px]"
              disabled={isLoading}
              onClick={() => {
                void refreshDownloads()
              }}
              type="button"
              variant="outline"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {loadError ? <ErrorState message={loadError} /> : null}

          <QueueTabs activeFilter={activeFilter} onChange={setActiveFilter} summary={summary} />

          <DownloadQueue
            canUseNativeShell={canUseNativeShell}
            downloads={filteredDownloads}
            filter={activeFilter}
            isLoading={isLoading}
            onCopyPath={(download) => {
              void handleCopyPath(download)
            }}
            onDelete={handleDelete}
            onPrimaryAction={(download) => {
              void handlePrimaryAction(download)
            }}
            pendingActionByTaskId={pendingActionByTaskId}
          />
        </section>

        <aside className="app-panel space-y-6 p-6 xl:col-span-2 min-[1500px]:col-span-1 min-[1500px]:h-[698px]">
          <div className="space-y-2">
            <h3 className="text-[20px] font-semibold leading-7 text-foreground">Live Events</h3>
            <p className="sr-only">最新状态事件会插入顶部，帮助确认队列是否仍在流动。</p>
          </div>

          {liveEvents.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border bg-[var(--surface-deep)] px-4 py-4 text-[13px] text-muted-foreground">
              暂无事件，新的下载状态和进度会显示在这里。
            </div>
          ) : (
            <div className="max-h-[592px] space-y-5 overflow-y-auto pr-1">
              {liveEvents.map((event) => (
                <div
                  className="grid grid-cols-[10px_minmax(0,1fr)] gap-3"
                  key={event.id}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      event.tone === "bad"
                        ? "bg-destructive"
                        : event.tone === "ok"
                          ? "bg-emerald-400"
                          : event.tone === "warn"
                            ? "bg-amber-300"
                            : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] leading-5 text-muted-foreground">{event.timestamp}</p>
                    <p className="mt-1 break-words text-[13px] leading-5 text-muted-foreground">{event.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 rounded-full border border-border bg-[var(--surface-deep)] px-3 py-2 text-[12px] font-semibold text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            {summary.activeCount > 0 ? `${summary.activeCount} active transfers` : "Event stream idle"}
          </div>
        </aside>
      </section>
    </section>
  )
}
