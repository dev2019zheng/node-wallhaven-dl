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
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function appendLiveEvent(currentEvents: LiveEventItem[], nextEvent: LiveEventItem): LiveEventItem[] {
  return [nextEvent, ...currentEvents].slice(0, 20)
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
        badge="实时任务队列"
        description="追踪下载中、已完成与失败任务。"
        eyebrow="Wallpaper transfer queue"
        title="下载"
      />

      <section className="grid gap-5 xl:grid-cols-[16rem_minmax(0,1fr)_18rem] xl:items-start">
        <aside className="app-panel space-y-4 border-border/90 p-4 lg:p-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Command center</h3>
            <p className="text-sm text-muted-foreground">用分离统计区分排队、下载中、完成与失败任务，避免把队列状态混成一个模糊总数。</p>
          </div>

          <dl className="grid gap-3">
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">排队中</dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.queuedCount}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">下载中</dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.runningCount}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">已完成</dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.completedCount}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">失败</dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.failedCount}</dd>
            </div>
          </dl>

          <div className="rounded-2xl border border-border/80 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">队列健康度</p>
            <p className="mt-2 leading-6">
              当前共 {summary.totalCount} 个任务，其中活跃任务 {summary.activeCount} 个。切换标签后保留同一份事件驱动数据源。
            </p>
          </div>
        </aside>

        <section className="app-panel space-y-4 border-border/90 p-4 lg:p-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">下载任务</h3>
            <p className="text-sm text-muted-foreground">
              进入页面后先拉取已有任务，再持续接收状态与进度事件。
            </p>
          </div>

          {loadError ? <ErrorState message={loadError} /> : null}

          <QueueTabs activeFilter={activeFilter} onChange={setActiveFilter} summary={summary} />

          <DownloadQueue
            downloads={filteredDownloads}
            filter={activeFilter}
            isLoading={isLoading}
          />
        </section>

        <aside className="app-panel space-y-4 border-border/90 p-4 lg:p-5">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live events</h3>
            <p className="text-sm text-muted-foreground">最新状态事件会插入顶部，帮助确认队列是否仍在流动。</p>
          </div>

          {liveEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
              暂无事件，新的下载状态和进度会显示在这里。
            </div>
          ) : (
            <div className="space-y-3">
              {liveEvents.map((event) => (
                <div
                  className="rounded-2xl border border-border/80 bg-background/60 px-4 py-3"
                  key={event.id}
                >
                  <div className="flex items-start gap-3">
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
                    <p className="text-sm leading-6 text-foreground">{event.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </section>
  )
}
