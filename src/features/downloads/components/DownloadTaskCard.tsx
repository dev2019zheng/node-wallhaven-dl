import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, FolderOpen, ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";

import type {
  DownloadListItem,
  DownloadTaskStatus,
} from "@/application/downloads/downloads.types";

type DownloadTaskCardProps = {
  canUseNativeShell: boolean;
  download: DownloadListItem;
  onCopyPath: (download: DownloadListItem) => void;
  onDelete: (download: DownloadListItem) => void;
  onPrimaryAction: (download: DownloadListItem) => void;
  pendingAction: "copy" | "delete" | "primary" | null;
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

function getTaskDetailLabel(download: DownloadListItem): string {
  switch (download.status) {
    case "queued":
      return "Waiting";
    case "running":
      return download.downloadedBytes > 0 ? "Byte progress" : "Connecting";
    case "succeeded":
      return download.absolutePath ? "Ready to open" : "Path unavailable";
    case "skipped_existing":
      return download.absolutePath ? "Already saved" : "Path unavailable";
    case "failed":
      return download.sourceUrl ? "Retry available" : "Retry URL unavailable";
  }
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

function getPrimaryActionMeta(download: DownloadListItem): {
  icon: ReactNode;
  label: string;
} {
  switch (download.status) {
    case "queued":
    case "running":
      return {
        icon: <FolderOpen className="h-4 w-4" />,
        label: download.absolutePath
          ? `Open folder for task ${download.id}`
          : `Open folder unavailable for task ${download.id}`,
      };
    case "succeeded":
    case "skipped_existing":
      return {
        icon: <ExternalLink className="h-4 w-4" />,
        label: download.absolutePath
          ? `Open file for task ${download.id}`
          : `Open file unavailable for task ${download.id}`,
      };
    case "failed":
      return {
        icon: <RotateCcw className="h-4 w-4" />,
        label: download.sourceUrl
          ? `Retry task ${download.id}`
          : `Retry unavailable for task ${download.id}`,
      };
  }
}

function isPrimaryActionDisabled(download: DownloadListItem, canUseNativeShell: boolean): boolean {
  if (download.status === "failed") {
    return !download.sourceUrl;
  }

  return !canUseNativeShell || !download.absolutePath;
}

function getCopyActionLabel(download: DownloadListItem): string {
  return download.absolutePath
    ? `Copy path for task ${download.id}`
    : `Copy path unavailable for task ${download.id}`;
}

function getPreviewSrc(download: DownloadListItem): string | null {
  if (
    !download.absolutePath ||
    (download.status !== "succeeded" && download.status !== "skipped_existing")
  ) {
    return null;
  }

  try {
    return convertFileSrc(download.absolutePath);
  } catch {
    return null;
  }
}

export function DownloadTaskCard({
  canUseNativeShell,
  download,
  onCopyPath,
  onDelete,
  onPrimaryAction,
  pendingAction,
}: DownloadTaskCardProps) {
  const progressLabel = getProgressLabel(download);
  const progressPercent = getProgressPercent(download) ?? 0;
  const primaryAction = getPrimaryActionMeta(download);
  const primaryActionDisabled =
    pendingAction === "primary" || isPrimaryActionDisabled(download, canUseNativeShell);
  const copyActionDisabled = pendingAction === "copy" || !download.absolutePath;
  const previewSrc = useMemo(() => getPreviewSrc(download), [download]);
  const [hasPreviewError, setHasPreviewError] = useState(false);
  const isDeleteDisabled =
    pendingAction === "delete" ||
    download.status === "queued" ||
    download.status === "running";

  useEffect(() => {
    setHasPreviewError(false);
  }, [previewSrc]);

  return (
    <article className="group h-[94px] rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-3 transition duration-200 hover:border-border-strong">
      <div className="grid h-full grid-cols-[74px_minmax(0,1fr)_118px_34px] items-center gap-4">
        <div className="h-[54px] w-[74px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-[var(--surface)]">
          {previewSrc && !hasPreviewError ? (
            <img
              alt={`Downloaded wallpaper ${download.wallpaperId}`}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setHasPreviewError(true)}
              src={previewSrc}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              <span className="sr-only">Preview unavailable for {download.fileName}</span>
            </div>
          )}
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
              <p className="mt-1 text-[11px] text-muted-foreground">{getTaskDetailLabel(download)}</p>
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
            aria-label={primaryAction.label}
            className="wh-icon-button h-8 w-8"
            disabled={primaryActionDisabled}
            onClick={() => onPrimaryAction(download)}
            type="button"
          >
            {primaryAction.icon}
          </button>
          <button
            aria-label={getCopyActionLabel(download)}
            className="wh-icon-button h-8 w-8"
            disabled={copyActionDisabled}
            onClick={() => onCopyPath(download)}
            type="button"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            aria-label={`Delete task ${download.id}`}
            className="wh-icon-button h-8 w-8"
            disabled={isDeleteDisabled}
            onClick={() => onDelete(download)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="sr-only">
          <span>{download.relativeFilePath}</span>
        </div>
      </div>
    </article>
  );
}
