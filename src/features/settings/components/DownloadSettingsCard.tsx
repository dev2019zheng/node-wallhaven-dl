import type { UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/button";

import { SettingsPanel } from "./SettingsPanel";

type SettingsFormValues = {
  wallhavenKey: string;
  customDownloadDirectoryPath: string;
  networkProxyScheme: "http" | "https" | "socks5";
  networkProxyAddress: string;
};

type DownloadSettingsCardProps = {
  customDirectoryError?: string;
  isDisabled: boolean;
  onInputChange: () => void;
  onUseDefaultDirectory: () => void;
  register: UseFormRegister<SettingsFormValues>;
};

export function DownloadSettingsCard({
  customDirectoryError,
  isDisabled,
  onInputChange,
  onUseDefaultDirectory,
  register,
}: DownloadSettingsCardProps) {
  return (
    <SettingsPanel
      description="Leave this blank to keep using the app-managed default directory. Enter an absolute path to move future downloads somewhere else without changing how Gallery tracks already archived files."
      title="Download settings"
    >
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
            onChange: onInputChange,
          })}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">
            Use an absolute folder path. The backend validates and persists the preference; Search,
            Downloads, and Gallery keep using the Rust path rules.
          </p>
          <Button disabled={isDisabled} onClick={onUseDefaultDirectory} type="button" variant="outline">
            Use app default directory
          </Button>
        </div>
        {customDirectoryError ? (
          <p className="text-sm text-destructive" role="alert">
            {customDirectoryError}
          </p>
        ) : null}
      </div>
    </SettingsPanel>
  );
}
