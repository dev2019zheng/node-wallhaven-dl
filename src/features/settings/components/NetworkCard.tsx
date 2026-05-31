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
    <SettingsPanel description="Network & proxy" title="Network">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="networkProxyScheme">
            代理类型
          </label>
          <select
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
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
        </div>

        <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="networkProxyAddress">
            代理地址
          </label>
          <input
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
            id="networkProxyAddress"
            placeholder="127.0.0.1:7897"
            spellCheck={false}
            type="text"
            {...register("networkProxyAddress", {
              onChange: onInputChange,
            })}
          />
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          当前仅保存代理协议和 host:port 文本，不在此页面提供实时连通性测试。
        </p>

        {networkProxyAddressError ? (
          <p className="text-sm text-destructive" role="alert">
            {networkProxyAddressError}
          </p>
        ) : null}
      </div>
    </SettingsPanel>
  );
}
