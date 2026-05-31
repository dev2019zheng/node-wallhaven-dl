import type { DownloadListItem } from "@/application/downloads/downloads.types"
import type { DownloadQueueFilter } from "@/application/downloads/downloads-service"
import { EmptyState } from "@/components/empty-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"

import { DownloadTaskCard } from "./DownloadTaskCard"

type DownloadQueueProps = {
  downloads: DownloadListItem[]
  filter: DownloadQueueFilter
  isLoading: boolean
  onCopyPath: (download: DownloadListItem) => void
  onDelete: (download: DownloadListItem) => void
  onPrimaryAction: (download: DownloadListItem) => void
  pendingActionByTaskId: Record<string, "copy" | "delete" | "primary" | null>
}

function getEmptyStateCopy(filter: DownloadQueueFilter): string {
  switch (filter) {
    case "all":
      return "No downloads yet. Start one from Search and track progress here."
    case "queued":
      return "No queued transfers right now."
    case "running":
      return "No running transfers right now."
    case "completed":
      return "No completed downloads yet."
    case "failed":
      return "No failed downloads right now."
  }
}

export function DownloadQueue({
  downloads,
  filter,
  isLoading,
  onCopyPath,
  onDelete,
  onPrimaryAction,
  pendingActionByTaskId,
}: DownloadQueueProps) {
  if (isLoading && downloads.length === 0) {
    return <LoadingSkeleton label="Loading existing downloads..." />
  }

  if (downloads.length === 0) {
    return <EmptyState title={getEmptyStateCopy(filter)} />
  }

  return (
    <div className="max-h-[548px] space-y-[18px] overflow-y-auto pr-1">
      {downloads.map((download) => (
        <DownloadTaskCard
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
