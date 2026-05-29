import type { UseFormRegister } from "react-hook-form";

import { SettingsPanel } from "./SettingsPanel";

type SettingsFormValues = {
  wallhavenKey: string;
  customDownloadDirectoryPath: string;
  networkProxyScheme: "http" | "https" | "socks5";
  networkProxyAddress: string;
};

type WallhavenAccessCardProps = {
  wallhavenKeyError?: string;
  onInputChange: () => void;
  register: UseFormRegister<SettingsFormValues>;
};

export function WallhavenAccessCard({
  register,
  wallhavenKeyError,
  onInputChange,
}: WallhavenAccessCardProps) {
  return (
    <SettingsPanel
      description="Save the optional WALLHAVEN_KEY locally so future desktop flows can reuse it."
      title="Wallhaven access"
    >
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
            onChange: onInputChange,
          })}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          The value is persisted through the Tauri Store plugin and can be cleared by saving an empty
          field.
        </p>
        {wallhavenKeyError ? (
          <p className="text-sm text-destructive" role="alert">
            {wallhavenKeyError}
          </p>
        ) : null}
      </div>
    </SettingsPanel>
  );
}
