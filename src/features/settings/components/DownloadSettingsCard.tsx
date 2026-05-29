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
    <SettingsPanel description="Download settings" title="Download settings">
      <div className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center">
          <label className="text-sm font-medium text-foreground" htmlFor="customDownloadDirectoryPath">
            下载目录
          </label>
          <input
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground outline-none transition focus:border-primary/55 focus:ring-2 focus:ring-primary/12"
            id="customDownloadDirectoryPath"
            placeholder="/Users/you/Pictures/Wallhaven"
            spellCheck={false}
            type="text"
            {...register("customDownloadDirectoryPath", {
              onChange: onInputChange,
            })}
          />
          <Button className="rounded-xl" disabled={isDisabled} onClick={onUseDefaultDirectory} type="button" variant="outline">
            恢复默认
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-center">
          <div className="text-sm font-medium text-foreground">批量页数</div>
          <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
            当前由搜索页内的批量下载页数字段控制。
          </div>
        </div>

        <p className="text-xs leading-6 text-muted-foreground">
          使用绝对路径即可让未来下载落到指定目录，Gallery 仍按 Rust 侧路径元数据定位已归档文件。
        </p>

        {customDirectoryError ? (
          <p className="text-sm text-destructive" role="alert">
            {customDirectoryError}
          </p>
        ) : null}
      </div>
    </SettingsPanel>
  );
}
