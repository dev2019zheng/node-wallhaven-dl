import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { loadSettings, saveSettings } from "@/application/settings/settings-service";
import type {
  DownloadDirectorySettings,
  NetworkProxyScheme,
} from "@/application/settings/settings.types";
import { Button } from "@/components/ui/button";

const settingsSchema = z.object({
  wallhavenKey: z.string().max(512, "WALLHAVEN_KEY is unexpectedly long."),
  customDownloadDirectoryPath: z
    .string()
    .max(4096, "Download directory path is unexpectedly long."),
  networkProxyScheme: z.enum(["http", "https", "socks5"]),
  networkProxyAddress: z.string().max(2048, "Proxy address is unexpectedly long."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type SaveFeedback = {
  tone: "success" | "error";
  message: string;
};

const networkProxyOptions: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getEffectiveDirectoryLabel(
  downloadDirectory: DownloadDirectorySettings | null,
  hasLoadError: boolean,
): string {
  if (!downloadDirectory) {
    return hasLoadError
      ? "Unavailable because settings failed to load"
      : "Loading effective directory...";
  }

  return downloadDirectory.effectiveDirectoryPath;
}

function getDefaultDirectoryLabel(
  downloadDirectory: DownloadDirectorySettings | null,
  hasLoadError: boolean,
): string {
  if (!downloadDirectory) {
    return hasLoadError
      ? "Unavailable because settings failed to load"
      : "Loading default directory...";
  }

  return downloadDirectory.defaultDirectoryPath;
}

export function SettingsPage() {
  const { formState, handleSubmit, register, reset, setValue } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      wallhavenKey: "",
      customDownloadDirectoryPath: "",
      networkProxyScheme: "http",
      networkProxyAddress: "",
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [downloadDirectory, setDownloadDirectory] =
    useState<DownloadDirectorySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    loadSettings()
      .then((snapshot) => {
        if (!isActive) {
          return;
        }

        reset({
          wallhavenKey: snapshot.wallhavenKey,
          customDownloadDirectoryPath: snapshot.downloadDirectory.customDirectoryPath,
          networkProxyScheme: snapshot.networkProxy?.scheme ?? "http",
          networkProxyAddress: snapshot.networkProxy?.address ?? "",
        });
        setDownloadDirectory(snapshot.downloadDirectory);
        setLoadError(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setLoadError(getErrorMessage(error, "Failed to load settings."));
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [reset]);

  const wallhavenKeyError = formState.errors.wallhavenKey?.message;
  const customDirectoryError = formState.errors.customDownloadDirectoryPath?.message;
  const networkProxyAddressError = formState.errors.networkProxyAddress?.message;

  const onSubmit = handleSubmit(async (values) => {
    setSaveFeedback(null);

    try {
      const snapshot = await saveSettings({
        wallhavenKey: values.wallhavenKey,
        customDownloadDirectoryPath: values.customDownloadDirectoryPath,
        networkProxyScheme: values.networkProxyScheme,
        networkProxyAddress: values.networkProxyAddress,
      });

      reset({
        wallhavenKey: snapshot.wallhavenKey,
        customDownloadDirectoryPath: snapshot.downloadDirectory.customDirectoryPath,
        networkProxyScheme: snapshot.networkProxy?.scheme ?? "http",
        networkProxyAddress: snapshot.networkProxy?.address ?? "",
      });
      setDownloadDirectory(snapshot.downloadDirectory);
      setSaveFeedback({
        tone: "success",
        message: "Settings saved.",
      });
    } catch (error) {
      setSaveFeedback({
        tone: "error",
        message: getErrorMessage(error, "Failed to save settings."),
      });
    }
  });

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border/80 bg-card/60 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
          Application settings
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage the local Wallhaven API key, download directory, and optional proxy settings for
              future Wallhaven desktop requests.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Tauri Store + SQLite backed
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <form className="space-y-6 rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm" onSubmit={onSubmit}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Wallhaven access</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Save the optional <code className="rounded bg-background/80 px-1 py-0.5 text-xs">WALLHAVEN_KEY</code> locally so future desktop flows can reuse it.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground" htmlFor="wallhavenKey">
              Wallhaven API key
            </label>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              id="wallhavenKey"
              placeholder="Paste your WALLHAVEN_KEY"
              spellCheck={false}
              type="password"
              {...register("wallhavenKey", {
                onChange: () => {
                  setSaveFeedback(null);
                },
              })}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              The value is persisted through the Tauri Store plugin and can be cleared by saving an
              empty field.
            </p>
            {wallhavenKeyError ? (
              <p className="text-sm text-destructive" role="alert">
                {wallhavenKeyError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-border/80 pt-6">
            <h3 className="text-lg font-semibold text-foreground">Download directory</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Leave this blank to keep using the app-managed default directory. Enter an absolute
              path to move future downloads somewhere else without changing how Gallery tracks
              already archived files.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground" htmlFor="customDownloadDirectoryPath">
              Custom download directory
            </label>
            <input
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
              id="customDownloadDirectoryPath"
              placeholder="/Users/you/Pictures/Wallhaven"
              spellCheck={false}
              type="text"
              {...register("customDownloadDirectoryPath", {
                onChange: () => {
                  setSaveFeedback(null);
                },
              })}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                Use an absolute folder path. The backend validates and persists the preference;
                Search, Downloads, and Gallery keep using the Rust path rules.
              </p>
              <Button
                disabled={isLoading || formState.isSubmitting}
                onClick={() => {
                  setValue("customDownloadDirectoryPath", "", {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  setSaveFeedback(null);
                }}
                type="button"
                variant="outline"
              >
                Use app default directory
              </Button>
            </div>
            {customDirectoryError ? (
              <p className="text-sm text-destructive" role="alert">
                {customDirectoryError}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-border/80 pt-6">
            <h3 className="text-lg font-semibold text-foreground">Network proxy</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Route Wallhaven search and downloads through a local proxy when direct requests fail.
              Leave the proxy address blank to keep using a direct connection.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-2 text-sm font-medium text-foreground" htmlFor="networkProxyScheme">
              <span>Proxy type</span>
              <select
                className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                id="networkProxyScheme"
                {...register("networkProxyScheme", {
                  onChange: () => {
                    setSaveFeedback(null);
                  },
                })}
              >
                {networkProxyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-foreground" htmlFor="networkProxyAddress">
              <span>Proxy address</span>
              <input
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                id="networkProxyAddress"
                placeholder="127.0.0.1:7897"
                spellCheck={false}
                type="text"
                {...register("networkProxyAddress", {
                  onChange: () => {
                    setSaveFeedback(null);
                  },
                })}
              />
            </label>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Choose the proxy protocol separately and enter only the host and port, for example
            <code className="ml-1 rounded bg-background/80 px-1 py-0.5 text-xs">127.0.0.1:7897</code>.
          </p>
          {networkProxyAddressError ? (
            <p className="text-sm text-destructive" role="alert">
              {networkProxyAddressError}
            </p>
          ) : null}

          {loadError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {loadError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button disabled={isLoading || formState.isSubmitting} type="submit">
              {formState.isSubmitting ? "Saving..." : "Save settings"}
            </Button>
            <p
              aria-live="polite"
              className={saveFeedback?.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-300"}
            >
              {saveFeedback ? saveFeedback.message : isLoading ? "Loading saved settings..." : ""}
            </p>
          </div>
        </form>

        <aside className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Effective download destination</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              This summary reflects where the next successful download will land. Existing gallery
              records keep their original paths even after you switch directories.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Next downloads</p>
            <code className="mt-3 block break-all rounded-xl bg-background/80 px-3 py-3 text-sm text-foreground">
              {getEffectiveDirectoryLabel(downloadDirectory, loadError !== null)}
            </code>
          </div>

          <dl className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Mode</dt>
              <dd className="mt-2 font-medium text-foreground">
                {downloadDirectory === null
                  ? loadError !== null
                    ? "Unavailable because settings failed to load"
                    : "Loading saved mode..."
                  : downloadDirectory.isUsingDefaultDirectory
                    ? "App default directory"
                    : "Custom override"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Default app directory</dt>
              <dd className="mt-2 break-all font-medium text-foreground">
                {getDefaultDirectoryLabel(downloadDirectory, loadError !== null)}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/30 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Gallery compatibility</dt>
              <dd className="mt-2 leading-6">
                Gallery now resolves archived files from the path metadata saved with each record,
                so changing this setting only affects future downloads.
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
