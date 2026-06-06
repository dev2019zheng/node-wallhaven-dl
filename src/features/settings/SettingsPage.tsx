import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  diagnoseWallhavenAccess,
  loadSettings,
  saveSettings,
} from "@/application/settings/settings-service";
import type {
  DownloadDirectorySettings,
  NetworkProxyScheme,
  SettingsPreferences,
} from "@/application/settings/settings.types";
import { ErrorState } from "@/components/error-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useUiShellStore } from "@/features/shell/ui-shell-store";
import { writeClipboardText } from "@/infrastructure/browser/clipboard";
import { chooseDirectory, revealPath } from "@/infrastructure/tauri/native-shell";
import { cn } from "@/lib/utils";

const settingsSchema = z.object({
  wallhavenKey: z.string().max(512, "WALLHAVEN_KEY is unexpectedly long."),
  customDownloadDirectoryPath: z.string().max(4096, "Download directory path is unexpectedly long."),
  networkProxyScheme: z.enum(["http", "https", "socks5"]),
  networkProxyAddress: z.string().max(2048, "Proxy address is unexpectedly long."),
  launchAtLogin: z.boolean(),
  confirmBeforeDelete: z.boolean(),
  telemetryEnabled: z.boolean(),
  cacheSizeBytes: z.number(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type SaveFeedback = {
  tone: "success" | "error" | "info";
  message: string;
};

type EffectiveDestinationSummary = {
  effectiveDirectoryPath: string;
  defaultDirectoryPath: string;
  modeLabel: string;
  proxyLabel: string;
  hasWarning: boolean;
};

const proxyOptions: Array<{ value: NetworkProxyScheme; label: string }> = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

const proxyLabels: Record<NetworkProxyScheme, string> = {
  http: "HTTP",
  https: "HTTPS",
  socks5: "SOCKS5",
};

const defaultPreferences: SettingsPreferences = {
  launchAtLogin: false,
  confirmBeforeDelete: true,
  telemetryEnabled: false,
  cacheSizeBytes: 38_400_000,
};

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function isAbsolutePath(path: string): boolean {
  const trimmed = path.trim();
  return trimmed.length === 0 || trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 MB";
  }

  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function Toggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="wh-kinetic-card flex min-h-[56px] items-center justify-between gap-4 rounded-[16px] border border-border bg-[var(--surface-deep)] px-4">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
        <p className="truncate text-[12px] text-muted-foreground">{description}</p>
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className={cn(
          "relative h-[22px] w-10 shrink-0 rounded-full transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-[var(--switch-track-on)]" : "bg-[var(--switch-track-off)]",
        )}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={cn(
            "absolute top-[3px] h-4 w-4 rounded-full transition duration-150",
            checked ? "left-[21px] bg-primary" : "left-[3px] bg-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}

function Spinner() {
  return <LoaderCircle className="h-4 w-4 animate-spin" />;
}

export function SettingsPage() {
  const { formState, handleSubmit, register, reset, setValue, watch } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      wallhavenKey: "",
      customDownloadDirectoryPath: "",
      networkProxyScheme: "http",
      networkProxyAddress: "",
      ...defaultPreferences,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [downloadDirectory, setDownloadDirectory] = useState<DownloadDirectorySettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageUnavailableReason, setStorageUnavailableReason] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<SaveFeedback | null>(null);
  const [proxyStatus, setProxyStatus] = useState<SaveFeedback | null>(null);
  const [isTestingProxy, setIsTestingProxy] = useState(false);
  const [isResettingCacheEstimate, setIsResettingCacheEstimate] = useState(false);
  const [isChoosingDirectory, setIsChoosingDirectory] = useState(false);
  const [isRevealingDirectory, setIsRevealingDirectory] = useState(false);
  const enqueueToast = useUiShellStore((state) => state.enqueueToast);
  const setConfirm = useUiShellStore((state) => state.setConfirm);

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
          ...snapshot.preferences,
        });
        setDownloadDirectory(snapshot.downloadDirectory);
        setStorageUnavailableReason(snapshot.storageUnavailableReason ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setLoadError(getErrorMessage(error, "Failed to load settings."));
        setStorageUnavailableReason(null);
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

  const values = watch();
  const trimmedDirectory = values.customDownloadDirectoryPath.trim();
  const trimmedProxyAddress = values.networkProxyAddress.trim();
  const hasCustomDirectoryOverride = trimmedDirectory.length > 0;
  const canResetCacheEstimate = values.cacheSizeBytes > 0;
  const directoryError = !isAbsolutePath(trimmedDirectory)
    ? "Folder does not exist or is not writable"
    : formState.errors.customDownloadDirectoryPath?.message;
  const proxyAddressError = trimmedProxyAddress.includes("://")
    ? "Proxy address must be host:port without a scheme"
    : formState.errors.networkProxyAddress?.message;
  const isStorageReadOnly = storageUnavailableReason !== null;
  const isEditingDisabled =
    isLoading || formState.isSubmitting || loadError !== null || isStorageReadOnly;
  const isSaveDisabled =
    isLoading ||
    formState.isSubmitting ||
    loadError !== null ||
    isStorageReadOnly ||
    !formState.isDirty ||
    Boolean(directoryError) ||
    Boolean(proxyAddressError);

  const effectiveDestination = useMemo<EffectiveDestinationSummary | null>(() => {
    if (!downloadDirectory) {
      return null;
    }

    const isUsingDefaultDirectory = trimmedDirectory.length === 0;

    return {
      effectiveDirectoryPath: isUsingDefaultDirectory ? downloadDirectory.defaultDirectoryPath : trimmedDirectory,
      defaultDirectoryPath: downloadDirectory.defaultDirectoryPath,
      modeLabel: isUsingDefaultDirectory ? "App default directory" : "Custom directory",
      proxyLabel: trimmedProxyAddress ? `${proxyLabels[values.networkProxyScheme]} · ${trimmedProxyAddress}` : "Direct connection",
      hasWarning: Boolean(directoryError || proxyAddressError),
    };
  }, [directoryError, downloadDirectory, proxyAddressError, trimmedDirectory, trimmedProxyAddress, values.networkProxyScheme]);

  const preferences: SettingsPreferences = {
    launchAtLogin: values.launchAtLogin,
    confirmBeforeDelete: values.confirmBeforeDelete,
    telemetryEnabled: values.telemetryEnabled,
    cacheSizeBytes: values.cacheSizeBytes,
  };
  const settingsFooterMessage =
    storageUnavailableReason ??
    (isLoading ? "Loading saved configuration..." : "Settings affect future tasks immediately after save.");
  const securitySummary = isStorageReadOnly
    ? "Desktop settings storage is unavailable in this web preview; API key persistence is disabled until the app runs inside Tauri."
    : "API key is masked in UI and persisted through the Tauri Store settings file.";

  const clearInlineFeedback = () => {
    setSaveFeedback(null);
    setApiKeyStatus(null);
    setProxyStatus(null);
  };

  const handleChooseDirectory = async () => {
    if (isStorageReadOnly) {
      showSettingsInfo(storageUnavailableReason ?? "Desktop storage is unavailable.");
      return;
    }

    setIsChoosingDirectory(true);

    try {
      const selectedPath = await chooseDirectory(
        trimmedDirectory || effectiveDestination?.effectiveDirectoryPath || downloadDirectory?.effectiveDirectoryPath,
      );

      if (!selectedPath) {
        return;
      }

      setValue("customDownloadDirectoryPath", selectedPath, {
        shouldDirty: true,
        shouldTouch: true,
      });
      clearInlineFeedback();
    } catch (error) {
      const message = getErrorMessage(error, "Unable to open the native directory picker.");
      setSaveFeedback({ tone: "error", message });
      enqueueToast({
        id: `settings-directory-picker-${Date.now()}`,
        title: "Directory picker failed",
        description: message,
        tone: "error",
      });
    } finally {
      setIsChoosingDirectory(false);
    }
  };

  const handleRevealDirectory = async () => {
    if (!effectiveDestination || effectiveDestination.hasWarning || isStorageReadOnly) {
      return;
    }

    setIsRevealingDirectory(true);

    try {
      await revealPath(effectiveDestination.effectiveDirectoryPath);
    } catch (error) {
      const message = getErrorMessage(error, "Unable to reveal the download directory.");
      setSaveFeedback({ tone: "error", message });
      enqueueToast({
        id: `settings-reveal-directory-${Date.now()}`,
        title: "Reveal failed",
        description: message,
        tone: "error",
      });
    } finally {
      setIsRevealingDirectory(false);
    }
  };

  const handleCopyEffectiveDirectory = async () => {
    if (!effectiveDestination) {
      return;
    }

    try {
      await writeClipboardText(effectiveDestination.effectiveDirectoryPath);
      showSettingsInfo("Effective path copied");
    } catch (error) {
      const message = getErrorMessage(error, "Clipboard is unavailable.");
      setSaveFeedback({ tone: "error", message });
      enqueueToast({
        id: `settings-copy-path-${Date.now()}`,
        title: "Copy path failed",
        description: message,
        tone: "error",
      });
    }
  };

  const showSettingsInfo = (message: string) => {
    setSaveFeedback({ tone: "info", message });
    enqueueToast({
      id: `settings-info-${Date.now()}`,
      title: message,
      tone: "info",
    });
  };

  const validateApiKey = async () => {
    if (isStorageReadOnly) {
      const status = { tone: "info" as const, message: storageUnavailableReason };
      setApiKeyStatus(status);
      enqueueToast({
        id: `settings-api-key-${Date.now()}`,
        title: "Desktop storage unavailable",
        description: storageUnavailableReason,
        tone: "info",
      });
      return;
    }

    const trimmedKey = values.wallhavenKey.trim();

    if (proxyAddressError) {
      const status = { tone: "error" as const, message: "Fix proxy settings before validating the API key." };
      setApiKeyStatus(status);
      enqueueToast({
        id: `settings-api-key-${Date.now()}`,
        title: status.message,
        tone: "error",
      });
      return;
    }

    if (trimmedKey.length === 0) {
      const status = { tone: "info" as const, message: "API key will be cleared after saving settings." };
      setApiKeyStatus(status);
      enqueueToast({
        id: `settings-api-key-${Date.now()}`,
        title: status.message,
        tone: "info",
      });
      return;
    }

    setIsValidatingKey(true);
    setApiKeyStatus(null);

    try {
      const diagnostic = await diagnoseWallhavenAccess({
        wallhavenKey: trimmedKey,
        networkProxyScheme: values.networkProxyScheme,
        networkProxyAddress: trimmedProxyAddress,
      });
      const status = {
        tone: "success" as const,
        message: diagnostic.usesProxy
          ? "Wallhaven accepted the request with this API key through the configured proxy."
          : "Wallhaven accepted the request with this API key.",
      };
      setApiKeyStatus(status);
      enqueueToast({
        id: `settings-api-key-${Date.now()}`,
        title: "API key checked",
        description: status.message,
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Unable to validate the API key against Wallhaven.");
      setApiKeyStatus({ tone: "error", message });
      enqueueToast({
        id: `settings-api-key-${Date.now()}`,
        title: "API key check failed",
        description: message,
        tone: "error",
      });
    } finally {
      setIsValidatingKey(false);
    }
  };

  const testProxy = async () => {
    if (isStorageReadOnly) {
      const status = { tone: "info" as const, message: storageUnavailableReason };
      setProxyStatus(status);
      enqueueToast({
        id: `settings-proxy-${Date.now()}`,
        title: "Desktop storage unavailable",
        description: storageUnavailableReason,
        tone: "info",
      });
      return;
    }

    if (proxyAddressError) {
      const status = { tone: "error" as const, message: "Fix proxy settings before testing connectivity." };
      setProxyStatus(status);
      enqueueToast({
        id: `settings-proxy-${Date.now()}`,
        title: status.message,
        tone: "error",
      });
      return;
    }

    setIsTestingProxy(true);
    setProxyStatus(null);

    try {
      const diagnostic = await diagnoseWallhavenAccess({
        networkProxyScheme: values.networkProxyScheme,
        networkProxyAddress: trimmedProxyAddress,
      });
      const status = {
        tone: "success" as const,
        message: diagnostic.usesProxy
          ? `${proxyLabels[values.networkProxyScheme]} proxy reached Wallhaven.`
          : "Direct Wallhaven connection succeeded.",
      };
      setProxyStatus(status);
      enqueueToast({
        id: `settings-proxy-${Date.now()}`,
        title: "Connectivity checked",
        description: status.message,
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Unable to reach Wallhaven with the current network settings.");
      setProxyStatus({ tone: "error", message });
      enqueueToast({
        id: `settings-proxy-${Date.now()}`,
        title: "Connectivity check failed",
        description: message,
        tone: "error",
      });
    } finally {
      setIsTestingProxy(false);
    }
  };

  const resetCacheEstimate = () => {
    setConfirm({
      title: "Reset cache estimate?",
      description: "No cache deletion command exists yet. This only resets the displayed cache estimate; downloaded wallpaper originals stay in place.",
      confirmLabel: "Reset estimate",
      onConfirm: () => {
        setIsResettingCacheEstimate(true);
        setValue("cacheSizeBytes", 0, { shouldDirty: true, shouldTouch: true });
        setIsResettingCacheEstimate(false);
        enqueueToast({
          id: `settings-cache-${Date.now()}`,
          title: "Cache estimate reset",
          description: "No downloaded wallpaper originals were removed.",
          tone: "success",
        });
      },
    });
  };

  const onSubmit = handleSubmit(async (formValues) => {
    if (loadError || storageUnavailableReason || directoryError || proxyAddressError) {
      return;
    }

    setSaveFeedback(null);

    try {
      const snapshot = await saveSettings({
        wallhavenKey: formValues.wallhavenKey,
        customDownloadDirectoryPath: formValues.customDownloadDirectoryPath,
        networkProxyScheme: formValues.networkProxyScheme,
        networkProxyAddress: formValues.networkProxyAddress,
        preferences: {
          launchAtLogin: formValues.launchAtLogin,
          confirmBeforeDelete: formValues.confirmBeforeDelete,
          telemetryEnabled: formValues.telemetryEnabled,
          cacheSizeBytes: formValues.cacheSizeBytes,
        },
      });

      reset({
        wallhavenKey: snapshot.wallhavenKey,
        customDownloadDirectoryPath: snapshot.downloadDirectory.customDirectoryPath,
        networkProxyScheme: snapshot.networkProxy?.scheme ?? "http",
        networkProxyAddress: snapshot.networkProxy?.address ?? "",
        ...snapshot.preferences,
      });
      setDownloadDirectory(snapshot.downloadDirectory);
      setStorageUnavailableReason(snapshot.storageUnavailableReason ?? null);
      setSaveFeedback({
        tone: "success",
        message: "Settings saved.",
      });
      enqueueToast({
        id: `settings-saved-${Date.now()}`,
        title: "Settings saved",
        description: "Future searches, downloads, and local library reads now use this configuration.",
        tone: "success",
      });
    } catch (error) {
      setSaveFeedback({
        tone: "error",
        message: getErrorMessage(error, "Failed to save settings."),
      });
    }
  });
  const headingBadge = isLoading
    ? { label: "Loading settings", tone: "info" as const }
    : loadError
      ? { label: "Settings unavailable", tone: "error" as const }
      : isStorageReadOnly
        ? { label: "Settings preview", tone: "warning" as const }
      : formState.isSubmitting
        ? { label: "Saving settings", tone: "info" as const }
        : formState.isDirty
          ? { label: "Unsaved changes", tone: "warning" as const }
          : { label: "Settings loaded", tone: "success" as const };

  return (
    <section className="space-y-6">
      <PageHeading
        badge={headingBadge.label}
        badgeTone={headingBadge.tone}
        description="API key, downloads, proxy, cache, and deletion safety."
        eyebrow="Application settings"
        title="Settings"
      />

      <div className="wh-dense-bento grid grid-cols-1 items-start gap-[22px] min-[1280px]:grid-cols-[minmax(0,1fr)_minmax(320px,452px)] min-[1440px]:gap-[30px]">
        <form className="app-panel min-h-0 space-y-6 p-5 min-[900px]:p-[30px] min-[1280px]:min-h-[640px]" onSubmit={onSubmit}>
          <section aria-labelledby="wallhaven-access-heading" className="space-y-4">
            <div>
              <h3 className="text-[20px] font-semibold leading-7 text-foreground" id="wallhaven-access-heading">
                Wallhaven Access
              </h3>
              <p className="text-[13px] leading-6 text-muted-foreground">
                API key is masked by default and stored through the desktop settings layer.
              </p>
            </div>

            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[124px_minmax(0,1fr)] md:gap-4">
              <label className="text-[13px] font-semibold text-foreground" htmlFor="wallhavenKey">
                API Key
              </label>
              <div className="relative">
                <input
                  autoComplete="off"
                  className="wh-control h-[42px] w-full pr-[92px] text-[13px]"
                  id="wallhavenKey"
                  placeholder="Paste WALLHAVEN_KEY"
                  spellCheck={false}
                  type={showApiKey ? "text" : "password"}
                  disabled={isEditingDisabled}
                  {...register("wallhavenKey", { onChange: clearInlineFeedback })}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                  <button
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    className="wh-icon-button h-8 w-8"
                    onClick={() => setShowApiKey((current) => !current)}
                    type="button"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    aria-label="Validate key"
                    className="wh-icon-button h-8 w-8"
                    disabled={isValidatingKey || isEditingDisabled}
                    onClick={validateApiKey}
                    type="button"
                  >
                    {isValidatingKey ? <Spinner /> : <ShieldCheck className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p
              aria-live="polite"
              className={cn("text-[12px] md:pl-[140px]", apiKeyStatus?.tone === "error" ? "text-destructive" : "text-muted-foreground")}
            >
              {apiKeyStatus?.message ?? "Empty value clears the local key. Full key is never written to UI logs."}
            </p>
          </section>

          <section aria-labelledby="download-directory-heading" className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-[20px] font-semibold leading-7 text-foreground" id="download-directory-heading">
                Download Directory
              </h3>
              <p className="text-[13px] leading-6 text-muted-foreground">
                Changing this path affects future downloads only. Existing Gallery records keep their archived file paths.
              </p>
            </div>

            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[124px_minmax(0,1fr)_96px] md:gap-4">
              <label className="text-[13px] font-semibold text-foreground" htmlFor="customDownloadDirectoryPath">
                Download path
              </label>
              <input
                autoComplete="off"
                className={cn(
                  "wh-control h-[42px] w-full text-[13px]",
                  directoryError ? "border-destructive/70 focus:border-destructive" : "",
                )}
                id="customDownloadDirectoryPath"
                placeholder="/Users/you/Pictures/Wallhaven"
                spellCheck={false}
                type="text"
                disabled={isEditingDisabled}
                {...register("customDownloadDirectoryPath", { onChange: clearInlineFeedback })}
              />
              <Button
                className="h-[42px] rounded-[14px]"
                disabled={isEditingDisabled || isChoosingDirectory}
                onClick={handleChooseDirectory}
                type="button"
                variant="outline"
              >
                <FolderOpen className="h-4 w-4" />
                {isChoosingDirectory ? "Choosing" : "Choose"}
              </Button>
            </div>
            {directoryError ? (
              <p className="text-[12px] text-destructive md:pl-[140px]" role="alert">
                {directoryError}
              </p>
            ) : null}
            <div className="md:pl-[140px]">
              <Button
                className="h-10 rounded-[14px]"
                disabled={isEditingDisabled || !hasCustomDirectoryOverride}
                onClick={() => {
                  setValue("customDownloadDirectoryPath", "", { shouldDirty: true, shouldTouch: true });
                  clearInlineFeedback();
                }}
                type="button"
                variant="ghost"
              >
                <RefreshCcw className="h-4 w-4" />
                Use app default directory
              </Button>
            </div>
          </section>

          <section aria-labelledby="network-heading" className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="text-[20px] font-semibold leading-7 text-foreground" id="network-heading">
                Network Proxy
              </h3>
              <p className="text-[13px] leading-6 text-muted-foreground">
                Leave address empty for direct Wallhaven API access.
              </p>
            </div>

            <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[124px_244px_minmax(0,1fr)_116px] md:gap-4">
              <span className="text-[13px] font-semibold text-foreground">Protocol</span>
              <div className="wh-control grid h-[42px] grid-cols-3 overflow-hidden p-0">
                {proxyOptions.map((option) => (
                  <button
                    aria-pressed={values.networkProxyScheme === option.value}
                    className={cn(
                      "text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                      values.networkProxyScheme === option.value ? "wh-selected-surface text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    key={option.value}
                    disabled={isEditingDisabled}
                    onClick={() => {
                      setValue("networkProxyScheme", option.value, { shouldDirty: true, shouldTouch: true });
                      clearInlineFeedback();
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                autoComplete="off"
                aria-label="Proxy address"
                className={cn(
                  "wh-control h-[42px] w-full text-[13px]",
                  proxyAddressError ? "border-destructive/70 focus:border-destructive" : "",
                )}
                placeholder="127.0.0.1:7897"
                spellCheck={false}
                type="text"
                disabled={isEditingDisabled}
                {...register("networkProxyAddress", { onChange: clearInlineFeedback })}
              />
              <Button className="h-[42px] rounded-[14px]" disabled={isTestingProxy || isEditingDisabled} onClick={testProxy} type="button" variant="outline">
                {isTestingProxy ? <Spinner /> : <TestTube2 className="h-4 w-4" />}
                Test
              </Button>
            </div>
            <p
              aria-live="polite"
              className={cn("text-[12px] md:pl-[140px]", proxyAddressError || proxyStatus?.tone === "error" ? "text-destructive" : "text-muted-foreground")}
              role={proxyAddressError ? "alert" : undefined}
            >
              {proxyAddressError ?? proxyStatus?.message ?? "Proxy validation runs before future Search and Download requests use this setting."}
            </p>
          </section>

          <section aria-labelledby="advanced-heading" className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-semibold leading-7 text-foreground" id="advanced-heading">
                  Advanced
                </h3>
                <p className="text-[13px] leading-6 text-muted-foreground">Deletion prompts and the local cache estimate.</p>
              </div>
              <Button className="h-10 rounded-[14px]" disabled={isResettingCacheEstimate || isEditingDisabled || !canResetCacheEstimate} onClick={resetCacheEstimate} type="button" variant="outline">
                {isResettingCacheEstimate ? <Spinner /> : <RefreshCcw className="h-4 w-4" />}
                Reset cache meter
              </Button>
            </div>

            <div className="grid max-w-[420px] grid-cols-1 gap-3">
              <Toggle
                checked={preferences.confirmBeforeDelete}
                description="Protect local files"
                disabled={isEditingDisabled}
                label="Ask before deleting"
                onChange={(checked) => setValue("confirmBeforeDelete", checked, { shouldDirty: true, shouldTouch: true })}
              />
            </div>
          </section>

          {storageUnavailableReason ? (
            <div className="rounded-[16px] border border-border px-4 py-3 text-[13px] leading-6 wh-soft-warning" role="status">
              <p className="font-semibold text-foreground">Desktop settings preview</p>
              <p className="text-muted-foreground">{storageUnavailableReason}</p>
            </div>
          ) : null}

          {loadError ? <ErrorState message={loadError} /> : null}

          <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-[var(--surface-deep)] px-5 py-3">
            <p
              aria-live="polite"
              className={cn(
                "text-[13px] font-medium",
                saveFeedback?.tone === "error" ? "text-destructive" : saveFeedback?.tone === "success" ? "text-emerald-300" : "text-muted-foreground",
              )}
            >
              {saveFeedback?.message ?? settingsFooterMessage}
            </p>
            <Button className="h-11 rounded-[14px]" disabled={isSaveDisabled} type="submit">
              {formState.isSubmitting ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />}
              Save settings
            </Button>
          </div>
        </form>

        <aside aria-label="Effective destination" className="app-panel min-h-0 p-5 min-[900px]:p-[30px] min-[1280px]:min-h-[640px]">
          {!downloadDirectory && !loadError ? <LoadingSkeleton label="Loading storage details..." /> : null}
          {!downloadDirectory && loadError ? (
            <ErrorState message="Settings failed to load, so storage summary is unavailable." title="Storage unavailable" />
          ) : null}

          {effectiveDestination ? (
            <div className="space-y-6">
              <div className={cn("rounded-[18px] p-5", effectiveDestination.hasWarning ? "wh-soft-warning" : "wh-soft-primary")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Next downloads</p>
                    <h3 className="mt-2 text-[20px] font-semibold leading-7 text-foreground">Effective Destination</h3>
                  </div>
                  {formState.isDirty ? (
                    <span className="wh-soft-warning rounded-full px-3 py-1 text-[12px] font-semibold">
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
                <code className="mt-5 block break-all rounded-[14px] border border-border bg-[var(--surface-deep)] px-4 py-4 text-[13px] leading-6 text-foreground">
                  {effectiveDestination.effectiveDirectoryPath}
                </code>
              </div>

              {[
                ["Mode", effectiveDestination.modeLabel],
                ["Default app directory", effectiveDestination.defaultDirectoryPath],
                ["Gallery compatibility", "Existing SQLite records keep their saved relative and absolute file paths."],
                ["Proxy", effectiveDestination.proxyLabel],
                ["Cache", `${formatBytes(values.cacheSizeBytes)} · meter reset never removes downloaded wallpaper originals.`],
                ["Security", securitySummary],
              ].map(([label, value]) => (
                <div className="rounded-[16px] border border-border bg-[var(--surface-deep)] px-4 py-4" key={label}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 break-words text-[13px] font-medium leading-6 text-foreground">{value}</p>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="h-10 rounded-[14px]"
                  onClick={() => {
                    void handleCopyEffectiveDirectory();
                  }}
                  type="button"
                  variant="ghost"
                >
                  <Copy className="h-4 w-4" />
                  Copy path
                </Button>
                <Button
                  className="h-10 rounded-[14px]"
                  disabled={!effectiveDestination || effectiveDestination.hasWarning || isRevealingDirectory || isStorageReadOnly}
                  onClick={handleRevealDirectory}
                  type="button"
                  variant="ghost"
                >
                  <FolderOpen className="h-4 w-4" />
                  {isRevealingDirectory ? "Revealing" : "Reveal"}
                </Button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
