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
    <SettingsPanel description="Wallhaven Access" title="Wallhaven access">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="wallhavenKey">
            API Key
          </label>
          <input
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
            id="wallhavenKey"
            placeholder="在此粘贴 WALLHAVEN_KEY"
            spellCheck={false}
            type="password"
            {...register("wallhavenKey", {
              onChange: onInputChange,
            })}
          />
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          当前通过 Tauri Store 持久化此值。清空输入并保存即可移除本地凭证。
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
