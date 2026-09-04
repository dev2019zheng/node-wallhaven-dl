import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, FolderOpen, ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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

function formatStatus(
  status: DownloadTaskStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (status) {
    case "queued":
      return t("downloads:status.queued");
    case "running":
      return t("downloads:status.running");
    case "succeeded":
      return t("downloads:status.succeeded");
    case "failed":
      return t("downloads:status.failed");
    case "skipped_existing":
      return t("downloads:status.skippedExisting");
  }
}

function getProgressLabel(
  download: DownloadListItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (download.downloadedBytes > 0 && download.totalBytes) {
    return `${formatBytes(download.downloadedBytes)} / ${formatBytes(download.totalBytes)}`;
  }

  if (download.downloadedBytes > 0) {
    return t("downloads:progressLabel.downloaded", { bytes: formatBytes(download.downloadedBytes) });
  }

  switch (download.status) {
    case "queued":
      return t("downloads:progressLabel.waitingToStart");
    case "running":
      return t("downloads:progressLabel.connecting");
    case "succeeded":
    case "skipped_existing":
      return t("downloads:progressLabel.savedToDisk");
    case "failed":
      return t("downloads:progressLabel.failedBeforeTransfer");
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

function getTaskDetailLabel(
  download: DownloadListItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (download.status) {
    case "queued":
      return t("downloads:detail.waiting");
    case "running":
      return download.downloadedBytes > 0 ? t("downloads:detail.byteProgress") : t("downloads:detail.connecting");
    case "succeeded":
      return download.absolutePath ? t("downloads:detail.readyToOpen") : t("downloads:detail.pathUnavailable");
    case "skipped_existing":
      return download.absolutePath ? t("downloads:detail.alreadySaved") : t("downloads:detail.pathUnavailable");
    case "failed":
      return download.sourceUrl ? t("downloads:detail.retryAvailable") : t("downloads:detail.retryUnavailable");
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

function getPrimaryActionMeta(
  download: DownloadListItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): {
  icon: ReactNode;
  label: string;
} {
  switch (download.status) {
    case "queued":
    case "running":
      return {
        icon: <FolderOpen className="h-4 w-4" />,
        label: download.absolutePath
          ? t("downloads:actions.openFolderForTask", { id: download.id })
          : t("downloads:actions.openFolderUnavailableForTask", { id: download.id }),
      };
    case "succeeded":
    case "skipped_existing":
      return {
        icon: <ExternalLink className="h-4 w-4" />,
        label: download.absolutePath
          ? t("downloads:actions.openFileForTask", { id: download.id })
          : t("downloads:actions.openFileUnavailableForTask", { id: download.id }),
      };
    case "failed":
      return {
        icon: <RotateCcw className="h-4 w-4" />,
        label: download.sourceUrl
          ? t("downloads:actions.retryTask", { id: download.id })
          : t("downloads:actions.retryUnavailableForTask", { id: download.id }),
      };
  }
}

function isPrimaryActionDisabled(download: DownloadListItem, canUseNativeShell: boolean): boolean {
  if (download.status === "failed") {
    return !download.sourceUrl;
  }

  return !canUseNativeShell || !download.absolutePath;
}

function getCopyActionLabel(
  download: DownloadListItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return download.absolutePath
    ? t("downloads:actions.copyPathForTask", { id: download.id })
    : t("downloads:actions.copyPathUnavailableForTask", { id: download.id });
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
  const { t } = useTranslation("downloads");
  const progressLabel = getProgressLabel(download, t);
  const progressPercent = getProgressPercent(download) ?? 0;
  const primaryAction = getPrimaryActionMeta(download, t);
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
    <article className="wh-kinetic-card group min-h-[94px] rounded-[18px] border border-border bg-[var(--surface-deep)] px-4 py-3 hover:border-border-strong">
      <div className="grid min-h-full grid-cols-[54px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[74px_minmax(0,1fr)_118px] sm:gap-4">
        <div className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-[var(--surface)] sm:w-[74px]">
          {previewSrc && !hasPreviewError ? (
            <img
              alt={`Downloaded wallpaper ${download.wallpaperId}`}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
              loading="lazy"
              onError={() => setHasPreviewError(true)}
              src={previewSrc}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              <span className="sr-only">{t("downloads:actions.previewUnavailable", { fileName: download.fileName })}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[minmax(0,1fr)_70px] sm:gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[14px] font-semibold leading-5 text-foreground">{download.fileName}</h4>
              <p className="mt-1 truncate text-[12px] leading-4 text-muted-foreground">
                {download.status === "failed" && download.failureReason ? download.failureReason : progressLabel}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className={`text-[13px] font-semibold ${statusTextClasses[download.status]}`}>{formatStatus(download.status, t)}</span>
              <p className="mt-1 text-[11px] text-muted-foreground">{getTaskDetailLabel(download, t)}</p>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${getProgressBarClass(download.status)}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-right text-[12px] font-medium text-muted-foreground">{progressPercent}%</span>
          </div>
        </div>

        <div className="col-span-2 flex items-center justify-end gap-2 opacity-100 transition group-hover:opacity-100 sm:col-span-1">
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
            aria-label={getCopyActionLabel(download, t)}
            className="wh-icon-button h-8 w-8"
            disabled={copyActionDisabled}
            onClick={() => onCopyPath(download)}
            type="button"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            aria-label={t("downloads:actions.deleteTask", { id: download.id })}
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
