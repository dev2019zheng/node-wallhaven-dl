import { Pause, Trash2, XCircle } from "lucide-react";

import type {
  DownloadListItem,
  DownloadTaskStatus,
} from "@/application/downloads/downloads.types";

type DownloadTaskCardProps = {
  download: DownloadListItem;
};

const statusTextClasses: Record<DownloadTaskStatus, string> = {
  queued: "text-slate-300",
  running: "text-primary",
  succeeded: "text-emerald-400",
  failed: "text-destructive",
  skipped_existing: "text-amber-300",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  });

  return `${formatter.format(value)} ${units[unitIndex]}`;
}

function formatStatus(status: DownloadTaskStatus): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "下载中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "下载失败";
    case "skipped_existing":
      return "已跳过";
  }
}

function getProgressLabel(download: DownloadListItem): string {
  if (download.downloadedBytes > 0 && download.totalBytes) {
    return `${formatBytes(download.downloadedBytes)} / ${formatBytes(download.totalBytes)}`;
  }

  if (download.downloadedBytes > 0) {
    return `${formatBytes(download.downloadedBytes)} downloaded`;
  }

  switch (download.status) {
    case "queued":
      return "等待开始";
    case "running":
      return "连接中";
    case "succeeded":
    case "skipped_existing":
      return "已完成";
    case "failed":
      return "传输前失败";
  }
}

function getProgressPercent(download: DownloadListItem): number | null {
  if (download.totalBytes && download.totalBytes > 0) {
    return Math.min(100, Math.round((download.downloadedBytes / download.totalBytes) * 100));
  }

  if (download.status === "succeeded" || download.status === "skipped_existing") {
    return 100;
  }

  return null;
}

function getSpeedLabel(download: DownloadListItem): string {
  if (download.status === "running" && download.totalBytes && download.downloadedBytes > 0) {
    const remainingBytes = Math.max(download.totalBytes - download.downloadedBytes, 0);
    const estimatedSpeed = remainingBytes === 0 ? download.totalBytes : remainingBytes / 3;
    return `${formatBytes(estimatedSpeed)}/s`;
  }

  if (download.status === "failed") {
    return "网络异常";
  }

  return download.status === "queued" ? "等待中" : "已完成";
}

export function DownloadTaskCard({ download }: DownloadTaskCardProps) {
  const progressLabel = getProgressLabel(download);
  const progressPercent = getProgressPercent(download);

  return (
    <article className="rounded-2xl border border-border bg-background/70 p-3 shadow-[0_16px_34px_rgb(2_6_23_/_0.16)]">
      <div className="flex gap-4">
        <div className="h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-card/70" />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h4 className="truncate text-sm font-semibold text-foreground">{download.fileName}</h4>
              <p className="truncate text-xs text-muted-foreground">{download.wallpaperId}</p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className={statusTextClasses[download.status]}>{formatStatus(download.status)}</span>
              <span className="text-muted-foreground">{getSpeedLabel(download)}</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <button
                  aria-label={`Pause task ${download.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 transition hover:text-foreground"
                  disabled
                  type="button"
                >
                  <Pause className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Cancel task ${download.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 transition hover:text-foreground"
                  disabled
                  type="button"
                >
                  <XCircle className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Delete task ${download.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/60 transition hover:text-foreground"
                  disabled
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {progressPercent !== null ? (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-card/70">
                <div
                  className={`h-full rounded-full ${
                    download.status === "failed"
                      ? "bg-destructive"
                      : download.status === "succeeded" || download.status === "skipped_existing"
                        ? "bg-emerald-400"
                        : "bg-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
              {progressLabel}
            </div>
          )}

          <p className="truncate text-xs text-muted-foreground">{download.relativeFilePath}</p>

          {download.status === "failed" && download.failureReason ? (
            <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {download.failureReason}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
