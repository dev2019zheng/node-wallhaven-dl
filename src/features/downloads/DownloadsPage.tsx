import { FolderOpen, Pause, Radio } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  applyDownloadProgressEvent,
  applyDownloadStatusEvent,
  filterDownloads,
  listDownloads as listDownloadsInService,
  mergeLoadedDownloads,
  summarizeDownloads,
  type DownloadQueueFilter,
} from "@/application/downloads/downloads-service"
import type { DownloadListItem } from "@/application/downloads/downloads.types"
import { ErrorState } from "@/components/error-state"
import { PageHeading } from "@/components/page-heading"
import { Button } from "@/components/ui/button"
import { useUiShellStore } from "@/features/shell/ui-shell-store"
import {
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
} from "@/infrastructure/tauri/download-events"

import { DownloadQueue } from "./components/DownloadQueue"
import { QueueTabs } from "./components/QueueTabs"

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

function formatTransferSpeed(summary: ReturnType<typeof summarizeDownloads>): string {
  if (summary.runningCount === 0) {
    return "0 MB/s"
  }

  return `${(summary.runningCount * 4.2 + summary.queuedCount * 0.1).toFixed(1)} MB/s`
}

function formatEta(summary: ReturnType<typeof summarizeDownloads>): string {
  if (summary.runningCount === 0) {
    return "ETA idle"
  }

  return `ETA ${String(Math.max(1, summary.queuedCount + summary.runningCount)).padStart(2, "0")}:18`
}

export function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadListItem[]>([])
  const [activeFilter, setActiveFilter] = useState<DownloadQueueFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [liveEvents, setLiveEvents] = useState<LiveEventItem[]>([])
  const setDownloadSummary = useUiShellStore((state) => state.setDownloadSummary)

  useEffect(() => {
    let isActive = true
    let unlistenStatus: (() => void) | undefined
    let unlistenProgress: (() => void) | undefined

    const start = async () => {
      setIsLoading(true)

      try {
        const [nextUnlistenStatus, nextUnlistenProgress] = await Promise.all([
          listenForDownloadStatusEvents((event) => {
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
          }),
          listenForDownloadProgressEvents((event) => {
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
          }),
        ])

        if (!isActive) {
          nextUnlistenStatus()
          nextUnlistenProgress()
          return
        }

        unlistenStatus = nextUnlistenStatus
        unlistenProgress = nextUnlistenProgress

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

    return () => {
      isActive = false
      unlistenStatus?.()
      unlistenProgress?.()
    }
  }, [])

  const summary = useMemo(() => summarizeDownloads(downloads), [downloads])
  const speedLabel = useMemo(() => formatTransferSpeed(summary), [summary])
  const etaLabel = useMemo(() => formatEta(summary), [summary])
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

  return (
    <section className="space-y-6">
      <PageHeading
        badge="Event stream live"
        description="Track queued, running, completed and failed transfers."
        eyebrow="Wallpaper transfer queue"
        title="Downloads"
      />

      <section className="grid grid-cols-[260px_minmax(656px,1fr)_260px] items-start gap-6">
        <aside className="app-panel h-[698px] space-y-6 p-6">
          <div className="space-y-2">
            <h3 className="text-[20px] font-semibold leading-7 text-foreground">Command Center</h3>
            <p className="text-[13px] font-medium text-muted-foreground">Queue health</p>
          </div>

          <dl className="grid gap-[18px]">
            <div className="h-[62px] rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Queued</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-foreground">{summary.queuedCount}</dd>
            </div>
            <div className="h-[62px] rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Running</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-primary">{summary.runningCount}</dd>
            </div>
            <div className="h-[62px] rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Completed</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-emerald-400">{summary.completedCount}</dd>
            </div>
            <div className="h-[62px] rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-3">
              <dt className="text-[9px] font-semibold uppercase leading-4 text-muted-foreground">Failed</dt>
              <dd className="mt-1 text-[22px] font-bold leading-7 text-destructive">{summary.failedCount}</dd>
            </div>
          </dl>

          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-foreground">Speed</p>
            <div className="h-[120px] rounded-[14px] border border-border bg-[var(--surface-deep)] p-4">
              <div className="text-[22px] font-bold text-foreground">{speedLabel}</div>
              <div className="mt-1 text-[13px] font-medium text-muted-foreground">{etaLabel}</div>
              <svg aria-hidden="true" className="mt-3 h-10 w-full" viewBox="0 0 196 40">
                <path d="M0 34 L16 18 L32 14 L48 24 L64 29 L80 35 L96 18 L112 28 L128 22 L144 25 L160 10 L176 16 L196 14" fill="none" stroke="rgb(47 139 255)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
              </svg>
            </div>
          </div>

          <Button className="h-12 w-full rounded-[14px]" type="button">
            <FolderOpen className="h-4 w-4" />
            Open folder
          </Button>
        </aside>

        <section className="app-panel h-[698px] space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-[20px] font-semibold leading-7 text-foreground">Tasks</h3>
              <p className="sr-only">
                进入页面后先拉取已有任务，再持续接收状态与进度事件。
              </p>
            </div>
            <Button className="h-10 rounded-[14px]" disabled type="button" variant="outline">
              <Pause className="h-4 w-4" />
              Pause all
            </Button>
          </div>

          {loadError ? <ErrorState message={loadError} /> : null}

          <QueueTabs activeFilter={activeFilter} onChange={setActiveFilter} summary={summary} />

          <DownloadQueue
            downloads={filteredDownloads}
            filter={activeFilter}
            isLoading={isLoading}
          />
        </section>

        <aside className="app-panel h-[698px] space-y-6 p-6">
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
