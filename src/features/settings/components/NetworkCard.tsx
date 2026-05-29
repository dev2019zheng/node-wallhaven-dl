import type { UseFormRegister } from "react-hook-form";

import type { NetworkProxyScheme } from "@/application/settings/settings.types";

import { SettingsPanel } from "./SettingsPanel";

type SettingsFormValues = {
  wallhavenKey: string;
  customDownloadDirectoryPath: string;
  networkProxyScheme: NetworkProxyScheme;
  networkProxyAddress: string;
};

type NetworkCardProps = {
  networkProxyAddressError?: string;
  onInputChange: () => void;
  proxyOptions: Array<{ value: NetworkProxyScheme; label: string }>;
  register: UseFormRegister<SettingsFormValues>;
};

export function NetworkCard({
  networkProxyAddressError,
  onInputChange,
  proxyOptions,
  register,
}: NetworkCardProps) {
  return (
    <SettingsPanel
      description="Route Wallhaven search and downloads through a local proxy when direct requests fail. Leave the proxy address blank to keep using a direct connection."
      title="Network"
    >
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <label className="space-y-2 text-sm font-medium text-foreground" htmlFor="networkProxyScheme">
          <span>Proxy type</span>
          <select
            className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-3 text-sm font-normal text-foreground outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
            id="networkProxyScheme"
            {...register("networkProxyScheme", {
              onChange: onInputChange,
            })}
          >
            {proxyOptions.map((option) => (
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
              onChange: onInputChange,
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
    </SettingsPanel>
  );
}
