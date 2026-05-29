import type { DownloadListItem } from "@/application/downloads/downloads.types"
import type { DownloadQueueFilter } from "@/application/downloads/downloads-service"
import { EmptyState } from "@/components/empty-state"
import { LoadingSkeleton } from "@/components/loading-skeleton"

import { DownloadTaskCard } from "./DownloadTaskCard"

type DownloadQueueProps = {
  downloads: DownloadListItem[]
  filter: DownloadQueueFilter
  isLoading: boolean
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

export function DownloadQueue({ downloads, filter, isLoading }: DownloadQueueProps) {
  if (isLoading && downloads.length === 0) {
    return <LoadingSkeleton label="Loading existing downloads..." />
  }

  if (downloads.length === 0) {
    return <EmptyState title={getEmptyStateCopy(filter)} />
  }

  return (
    <div className="space-y-3">
      {downloads.map((download) => (
        <DownloadTaskCard download={download} key={download.id} />
      ))}
    </div>
  )
}
