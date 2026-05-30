import { Check, Copy, ExternalLink, Pause, RefreshCw, RotateCcw, Trash2, XCircle } from "lucide-react";

import type {
  DownloadListItem,
  DownloadTaskStatus,
} from "@/application/downloads/downloads.types";

type DownloadTaskCardProps = {
  download: DownloadListItem;
};

const statusTextClasses: Record<DownloadTaskStatus, string> = {
  queued: "text-muted-foreground",
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
      return "Queued";
    case "running":
      return "Downloading";
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "skipped_existing":
      return "Skipped";
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
      return "Waiting to start";
    case "running":
      return "Connecting";
    case "succeeded":
    case "skipped_existing":
      return "Saved to disk";
    case "failed":
      return "Failed before transfer";
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
    return "Network error";
  }

  return download.status === "queued" ? "Waiting" : "Ready";
}

function getProgressBarClass(status: DownloadTaskStatus): string {
  switch (status) {
    case "failed":
      return "bg-destructive";
    case "succeeded":
    case "skipped_existing":
      return "bg-emerald-400";
    case "queued":
      return "bg-muted-foreground";
    case "running":
      return "bg-primary";
  }
}

function getActionIcon(status: DownloadTaskStatus) {
  switch (status) {
    case "queued":
      return <RefreshCw className="h-4 w-4" />;
    case "running":
      return <Pause className="h-4 w-4" />;
    case "succeeded":
    case "skipped_existing":
      return <ExternalLink className="h-4 w-4" />;
    case "failed":
      return <RotateCcw className="h-4 w-4" />;
  }
}

export function DownloadTaskCard({ download }: DownloadTaskCardProps) {
  const progressLabel = getProgressLabel(download);
  const progressPercent = getProgressPercent(download) ?? 0;

  return (
    <article className="group h-[94px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3 transition duration-200 hover:border-border-strong">
      <div className="grid h-full grid-cols-[74px_minmax(0,1fr)_118px_34px] items-center gap-4">
        <div className="h-[54px] w-[74px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-[var(--surface)]">
          <div className="h-full w-full bg-[linear-gradient(150deg,#253956_0%,#1b2b43_46%,#0b1726_47%,#0b1726_100%)]" />
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_70px] items-start gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[14px] font-semibold leading-5 text-foreground">{download.fileName}</h4>
              <p className="mt-1 truncate text-[12px] leading-4 text-muted-foreground">
                {download.status === "failed" && download.failureReason ? download.failureReason : progressLabel}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-[13px] font-semibold ${statusTextClasses[download.status]}`}>{formatStatus(download.status)}</span>
              <p className="mt-1 text-[11px] text-muted-foreground">{getSpeedLabel(download)}</p>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${getProgressBarClass(download.status)}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-right text-[12px] font-medium text-muted-foreground">{progressPercent}%</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 opacity-100 transition group-hover:opacity-100">
          <button
            aria-label={`Primary action for task ${download.id}`}
            className="wh-icon-button h-8 w-8"
            disabled
            type="button"
          >
            {download.status === "succeeded" || download.status === "skipped_existing" ? <Check className="h-4 w-4 text-emerald-400" /> : getActionIcon(download.status)}
          </button>
          <button
            aria-label={`Copy path for task ${download.id}`}
            className="wh-icon-button h-8 w-8"
            disabled
            type="button"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            aria-label={`Delete task ${download.id}`}
            className="wh-icon-button h-8 w-8"
            disabled
            type="button"
          >
            {download.status === "running" ? <XCircle className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>

        <div className="sr-only">
          <span>{download.relativeFilePath}</span>
        </div>
      </div>
    </article>
  );
}
