import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { loadSettings, saveSettings } from "@/application/settings/settings-service";
import type { DownloadStrategy } from "@/application/settings/settings.types";
import { Button } from "@/components/ui/button";

const settingsSchema = z.object({
  wallhavenKey: z.string().max(512, "WALLHAVEN_KEY is unexpectedly long."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type SaveFeedback = {
  tone: "success" | "error";
  message: string;
};

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function formatDownloadStrategy(strategy: DownloadStrategy | null): string {
  if (!strategy) {
    return "Loading default strategy...";
  }

  return `${strategy.baseDir}/${strategy.relativePath}`;
}

export function SettingsPage() {
  const {
    formState,
    handleSubmit,
    register,
    reset,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      wallhavenKey: "",
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [defaultDownloadStrategy, setDefaultDownloadStrategy] = useState<DownloadStrategy | null>(null);
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

        reset({ wallhavenKey: snapshot.wallhavenKey });
        setDefaultDownloadStrategy(snapshot.defaultDownloadStrategy);
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

  const onSubmit = handleSubmit(async (values) => {
    setSaveFeedback(null);

    try {
      await saveSettings({ wallhavenKey: values.wallhavenKey });
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
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Application settings</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage the local Wallhaven API key and review where desktop downloads will land by default.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Tauri Store backed
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
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
              The value is persisted through the Tauri Store plugin and can be cleared by saving an empty field.
            </p>
            {wallhavenKeyError ? (
              <p className="text-sm text-destructive" role="alert">
                {wallhavenKeyError}
              </p>
            ) : null}
          </div>

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
            <h3 className="text-lg font-semibold text-foreground">Default download directory</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Downloads default to the app-specific writable data directory instead of a hard-coded global path.
            </p>
          </div>

          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">Strategy</p>
            <code className="mt-3 block break-all rounded-xl bg-background/80 px-3 py-3 text-sm text-foreground">
              {formatDownloadStrategy(defaultDownloadStrategy)}
            </code>
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Base directory: <span className="font-medium text-foreground">AppLocalData</span></li>
            <li>Relative path: <span className="font-medium text-foreground">wallpapers</span></li>
            <li>Actual filesystem path is resolved by Tauri per operating system.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
