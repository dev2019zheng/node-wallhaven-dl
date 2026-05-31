import type { DownloadDirectorySettings } from "@/application/settings/settings.types";
import { ErrorState } from "@/components/error-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";

import { SettingsPanel } from "./SettingsPanel";

type EffectiveDestinationSummary = {
  effectiveDirectoryPath: string;
  defaultDirectoryPath: string;
  modeLabel: string;
  proxyLabel: string;
};

type StorageAboutCardProps = {
  downloadDirectory: DownloadDirectorySettings | null;
  effectiveDestination: EffectiveDestinationSummary | null;
  hasLoadError: boolean;
  hasUnsavedChanges: boolean;
};

export function StorageAboutCard({
  downloadDirectory,
  effectiveDestination,
  hasLoadError,
  hasUnsavedChanges,
}: StorageAboutCardProps) {
  const isLoading = !downloadDirectory && !hasLoadError;

  return (
    <SettingsPanel description="Effective destination" title="生效结果">
      {isLoading ? <LoadingSkeleton label="Loading storage details..." /> : null}

      {!downloadDirectory && hasLoadError ? (
        <ErrorState
          message="设置加载失败，因此当前无法显示存储摘要。"
          title="存储信息不可用"
        />
      ) : null}

      {downloadDirectory && effectiveDestination ? (
        <div className="space-y-4">
          <div className="wh-soft-primary rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Next downloads</p>
                <p className="mt-2 text-sm font-medium text-foreground">下一次下载会写入以下目录</p>
              </div>
              {hasUnsavedChanges ? (
                <span className="wh-soft-warning inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                  未保存更改
                </span>
              ) : null}
            </div>
            <code className="mt-3 block break-all rounded-xl bg-background/80 px-3 py-3 text-sm text-foreground">
              {effectiveDestination.effectiveDirectoryPath}
            </code>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-2 rounded-xl border border-border/85 bg-background/45 px-3 py-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">模式</div>
              <div className="font-medium text-foreground">{effectiveDestination.modeLabel}</div>
            </div>
            <div className="grid gap-2 rounded-xl border border-border/85 bg-background/45 px-3 py-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">默认路径</div>
              <div className="break-all font-medium text-foreground">{effectiveDestination.defaultDirectoryPath}</div>
            </div>
            <div className="grid gap-2 rounded-xl border border-border/85 bg-background/45 px-3 py-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">代理</div>
              <div className="font-medium text-foreground">{effectiveDestination.proxyLabel}</div>
            </div>
            <div className="grid gap-2 rounded-xl border border-border/85 bg-background/45 px-3 py-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">兼容性</div>
              <div>
                Gallery 会按归档记录中的路径元数据定位文件，因此修改下载目录只影响未来下载。
              </div>
            </div>
            <div className="grid gap-2 rounded-xl border border-border/85 bg-background/45 px-3 py-3 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">缓存</div>
              <div>当前未暴露缓存大小与清理操作，现有下载原图不会被此摘要卡删除。</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">当前页面仍保留事实性边界说明。</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
          <li>文件命名规则和并发下载数仍沿用后端默认值。</li>
          <li>缓存大小、缓存清理和 SQLite 状态暂未暴露。</li>
          <li>API 连通性测试和检查更新当前不在此页面提供。</li>
        </ul>
      </div>
    </SettingsPanel>
  );
}
