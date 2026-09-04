import type { DownloadListItem } from "@/application/downloads/downloads.types"
import type { DownloadQueueFilter } from "@/application/downloads/downloads-service"
import { EmptyState } from "@/components/empty-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { useTranslation } from "react-i18next"

import { DownloadTaskCard } from "./DownloadTaskCard"

type DownloadQueueProps = {
  canUseNativeShell: boolean
  downloads: DownloadListItem[]
  filter: DownloadQueueFilter
  isLoading: boolean
  onCopyPath: (download: DownloadListItem) => void
  onDelete: (download: DownloadListItem) => void
  onPrimaryAction: (download: DownloadListItem) => void
  pendingActionByTaskId: Record<string, "copy" | "delete" | "primary" | null>
}

function getEmptyStateKey(filter: DownloadQueueFilter): "empty.all" | "empty.queued" | "empty.running" | "empty.completed" | "empty.failed" {
  switch (filter) {
    case "all":
      return "empty.all"
    case "queued":
      return "empty.queued"
    case "running":
      return "empty.running"
    case "completed":
      return "empty.completed"
    case "failed":
      return "empty.failed"
  }
}

export function DownloadQueue({
  canUseNativeShell,
  downloads,
  filter,
  isLoading,
  onCopyPath,
  onDelete,
  onPrimaryAction,
  pendingActionByTaskId,
}: DownloadQueueProps) {
  const { t } = useTranslation("downloads")

  if (isLoading && downloads.length === 0) {
    return <LoadingSkeleton label={t("loading")} />
  }

  if (downloads.length === 0) {
    return <EmptyState title={t(getEmptyStateKey(filter))} />
  }

  return (
    <div className="max-h-[548px] space-y-[18px] overflow-y-auto pr-1">
      {downloads.map((download) => (
        <DownloadTaskCard
          canUseNativeShell={canUseNativeShell}
          download={download}
          key={download.id}
          onCopyPath={onCopyPath}
          onDelete={onDelete}
          onPrimaryAction={onPrimaryAction}
          pendingAction={pendingActionByTaskId[download.id] ?? null}
        />
      ))}
    </div>
  )
}
