import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { loadSettings, saveSettings } from "@/application/settings/settings-service";
import type {
  DownloadDirectorySettings,
  NetworkProxyScheme,
} from "@/application/settings/settings.types";
import { ErrorState } from "@/components/error-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

import { DownloadSettingsCard } from "./components/DownloadSettingsCard";
import { NetworkCard } from "./components/NetworkCard";
import { StorageAboutCard } from "./components/StorageAboutCard";
import { WallhavenAccessCard } from "./components/WallhavenAccessCard";

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
  const enqueueToast = useUiShellStore((state) => state.enqueueToast);

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
  const hasLoadError = loadError !== null;
  const isSaveDisabled = isLoading || formState.isSubmitting || hasLoadError;

  const clearSaveFeedback = () => {
    setSaveFeedback(null);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (hasLoadError) {
      return;
    }

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
      enqueueToast({
        id: `settings-saved-${Date.now()}`,
        title: "Settings saved",
        description: "Your desktop defaults are ready for future searches and downloads.",
        tone: "success",
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
      <PageHeading
        badge="Tauri Store + SQLite backed"
        description="Manage API access, storage, and proxy defaults."
        eyebrow="Application settings"
        title="Settings"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:items-start">
        <form
          className="space-y-4 rounded-3xl border border-border/80 bg-card/50 p-6 shadow-sm"
          onSubmit={onSubmit}
        >
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Settings workspace</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Group related controls into focused cards while keeping the same validation, load, and
              save contract behind the page.
            </p>
          </div>

          <WallhavenAccessCard
            onInputChange={clearSaveFeedback}
            register={register}
            wallhavenKeyError={wallhavenKeyError}
          />

          <DownloadSettingsCard
            customDirectoryError={customDirectoryError}
            isDisabled={isLoading || formState.isSubmitting}
            onInputChange={clearSaveFeedback}
            onUseDefaultDirectory={() => {
              setValue("customDownloadDirectoryPath", "", {
                shouldDirty: true,
                shouldTouch: true,
              });
              clearSaveFeedback();
            }}
            register={register}
          />

          <NetworkCard
            networkProxyAddressError={networkProxyAddressError}
            onInputChange={clearSaveFeedback}
            proxyOptions={networkProxyOptions}
            register={register}
          />

          {loadError ? <ErrorState message={loadError} /> : null}

          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Persist desktop defaults</p>
              <p
                aria-live="polite"
                className={saveFeedback?.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-300"}
              >
                {saveFeedback ? saveFeedback.message : isLoading ? "Loading saved settings..." : ""}
              </p>
            </div>
            <Button disabled={isSaveDisabled} type="submit">
              {formState.isSubmitting ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4 rounded-3xl border border-border/80 bg-card/40 p-6 shadow-sm">
          <StorageAboutCard downloadDirectory={downloadDirectory} hasLoadError={loadError !== null} />
        </aside>
      </div>
    </section>
  );
}
