import { useEffect, useState } from "react"

import {
  applyDownloadProgressEvent,
  applyDownloadStatusEvent,
  listDownloads as listDownloadsInService,
  mergeLoadedDownloads,
} from "@/application/downloads/downloads-service"
import type {
  DownloadListItem,
  DownloadTaskStatus,
} from "@/application/downloads/downloads.types"
import {
  listenForDownloadProgressEvents,
  listenForDownloadStatusEvents,
} from "@/infrastructure/tauri/download-events"
import { PageHeading } from "@/components/page-heading"

const statusBadgeClasses: Record<DownloadTaskStatus, string> = {
  queued: "border-slate-400/20 bg-slate-400/10 text-slate-200",
  running: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  succeeded: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  skipped_existing: "border-amber-400/20 bg-amber-400/10 text-amber-200",
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
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

  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  })

  return `${formatter.format(value)} ${units[unitIndex]}`
}

function formatStatus(status: DownloadTaskStatus): string {
  switch (status) {
    case "queued":
      return "Queued"
    case "running":
      return "Running"
    case "succeeded":
      return "Succeeded"
    case "failed":
      return "Failed"
    case "skipped_existing":
      return "Skipped existing"
  }
}

function getProgressLabel(download: DownloadListItem): string {
  if (download.downloadedBytes > 0 && download.totalBytes) {
    return `${formatBytes(download.downloadedBytes)} / ${formatBytes(download.totalBytes)}`
  }

  if (download.downloadedBytes > 0) {
    return `${formatBytes(download.downloadedBytes)} downloaded`
  }

  switch (download.status) {
    case "queued":
      return "Waiting to start"
    case "running":
      return "Connecting..."
    case "succeeded":
    case "skipped_existing":
      return "Completed"
    case "failed":
      return "Failed before transfer"
  }
}

function getProgressPercent(download: DownloadListItem): number | null {
  if (download.totalBytes && download.totalBytes > 0) {
    return Math.min(100, Math.round((download.downloadedBytes / download.totalBytes) * 100))
  }

  if (download.status === "succeeded" || download.status === "skipped_existing") {
    return 100
  }

  return null
}

export function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  return (
    <section className="space-y-6">
      <PageHeading
        badge="Live command + event stream backed"
        description="Track queued, running, completed, and failed transfers."
        eyebrow="Wallpaper transfer queue"
        title="Downloads"
      />

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Tasks</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Existing tasks load on page entry, then status and byte progress continue to stream in
            over the shared Tauri download events.
          </p>
        </div>

        {loadError ? (
          <div
            className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {loadError}
          </div>
        ) : null}

        {isLoading && downloads.length === 0 ? (
          <div className="rounded-2xl border border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground">
            Loading existing downloads...
          </div>
        ) : null}

        {!isLoading && downloads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
            No downloads yet. Start one from Search and track progress here.
          </div>
        ) : null}

        {downloads.length > 0 ? (
          <div className="space-y-3">
            {downloads.map((download) => {
              const progressLabel = getProgressLabel(download)
              const progressPercent = getProgressPercent(download)

              return (
                <article
                  className="rounded-2xl border border-border/80 bg-background/80 p-5 shadow-sm"
                  key={download.id}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        {download.fileName}
                      </h4>
                      <p className="break-all text-xs text-muted-foreground">
                        {download.relativeFilePath || "Path pending until task metadata syncs."}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClasses[download.status]}`}
                    >
                      {formatStatus(download.status)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-card/40 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                        Wallpaper ID
                      </dt>
                      <dd className="mt-2 font-medium text-foreground">{download.wallpaperId}</dd>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-card/40 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                        Progress
                      </dt>
                      <dd className="mt-2 font-medium text-foreground">{progressLabel}</dd>
                    </div>
                  </dl>

                  {progressPercent !== null ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Transfer completion</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-background/80">
                        <div
                          className="h-full rounded-full bg-sky-400 transition-[width]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {download.status === "failed" && download.failureReason ? (
                    <div className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      Failure reason: {download.failureReason}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </section>
  )
}
