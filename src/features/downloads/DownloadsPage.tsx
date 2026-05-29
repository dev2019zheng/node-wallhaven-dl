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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

export function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadListItem[]>([])
  const [activeFilter, setActiveFilter] = useState<DownloadQueueFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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
          }),
          listenForDownloadProgressEvents((event) => {
            if (!isActive) {
              return
            }

            setDownloads((currentDownloads) =>
              applyDownloadProgressEvent(currentDownloads, event.payload),
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

      <section className="app-panel space-y-4 border-border/90 p-4 lg:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">下载任务</h3>
            <p className="text-sm text-muted-foreground">
              进入页面后先拉取已有任务，再持续接收状态与进度事件。
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3 xl:min-w-[24rem]">
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                下载中
              </dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.activeCount}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                已完成
              </dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.completedCount}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                失败
              </dt>
              <dd className="mt-2 text-xl font-semibold text-foreground">{summary.failedCount}</dd>
            </div>
          </dl>
        </div>

        {loadError ? <ErrorState message={loadError} /> : null}

        <QueueTabs activeFilter={activeFilter} onChange={setActiveFilter} summary={summary} />

        <DownloadQueue
          downloads={filteredDownloads}
          filter={activeFilter}
          isLoading={isLoading}
        />
      </section>
    </section>
  )
}
