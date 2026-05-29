import type { DownloadDirectorySettings } from "@/application/settings/settings.types";
import { ErrorState } from "@/components/error-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";

import { SettingsPanel } from "./SettingsPanel";

type StorageAboutCardProps = {
  downloadDirectory: DownloadDirectorySettings | null;
  hasLoadError: boolean;
};

function getModeLabel(downloadDirectory: DownloadDirectorySettings): string {
  return downloadDirectory.isUsingDefaultDirectory ? "App default directory" : "Custom override";
}

export function StorageAboutCard({ downloadDirectory, hasLoadError }: StorageAboutCardProps) {
  const isLoading = !downloadDirectory && !hasLoadError;

  return (
    <SettingsPanel
      description="Storage details stay read-only here because this page only reflects capabilities currently exposed by the backend."
      title="Storage and about"
    >
      {isLoading ? <LoadingSkeleton label="Loading storage details..." /> : null}

      {!downloadDirectory && hasLoadError ? (
        <ErrorState
          message="Settings failed to load, so storage information is unavailable."
          title="Storage details unavailable"
        />
      ) : null}

      {downloadDirectory ? (
        <>
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Next downloads</p>
            <code className="mt-3 block break-all rounded-xl bg-background/80 px-3 py-3 text-sm text-foreground">
              {downloadDirectory.effectiveDirectoryPath}
            </code>
          </div>

          <dl className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Mode</dt>
              <dd className="mt-2 font-medium text-foreground">{getModeLabel(downloadDirectory)}</dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Default app directory</dt>
              <dd className="mt-2 break-all font-medium text-foreground">
                {downloadDirectory.defaultDirectoryPath}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Gallery compatibility</dt>
              <dd className="mt-2 leading-6">
                Gallery now resolves archived files from the path metadata saved with each record, so
                changing this setting only affects future downloads.
              </dd>
            </div>
          </dl>
        </>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Additional desktop controls are not exposed on this page.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
          <li>File naming rules and concurrent download limits follow backend defaults.</li>
          <li>Cache size, cache cleanup, and SQLite state inspection are not exposed on this page.</li>
          <li>API connectivity tests and update checks are omitted because the backend does not expose them here.</li>
        </ul>
      </div>
    </SettingsPanel>
  );
}
