import type { DownloadDirectorySettings } from "@/application/settings/settings.types";
import { ErrorState } from "@/components/error-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";

import { SettingsPanel } from "./SettingsPanel";

type StorageAboutCardProps = {
  downloadDirectory: DownloadDirectorySettings | null;
  hasLoadError: boolean;
};

function getModeLabel(downloadDirectory: DownloadDirectorySettings): string {
  return downloadDirectory.isUsingDefaultDirectory ? "应用默认目录" : "自定义路径";
}

export function StorageAboutCard({ downloadDirectory, hasLoadError }: StorageAboutCardProps) {
  const isLoading = !downloadDirectory && !hasLoadError;

  return (
    <SettingsPanel description="Storage & about" title="Storage and about">
      {isLoading ? <LoadingSkeleton label="Loading storage details..." /> : null}

      {!downloadDirectory && hasLoadError ? (
        <ErrorState
          message="设置加载失败，因此当前无法显示存储摘要。"
          title="存储信息不可用"
        />
      ) : null}

      {downloadDirectory ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-primary/18 bg-primary/8 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">下载目录</p>
            <code className="mt-3 block break-all rounded-xl bg-background/80 px-3 py-3 text-sm text-foreground">
              {downloadDirectory.effectiveDirectoryPath}
            </code>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start rounded-xl border border-border/85 bg-background/45 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">模式</div>
              <div className="font-medium text-foreground">{getModeLabel(downloadDirectory)}</div>
            </div>
            <div className="grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start rounded-xl border border-border/85 bg-background/45 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">默认路径</div>
              <div className="break-all font-medium text-foreground">{downloadDirectory.defaultDirectoryPath}</div>
            </div>
            <div className="grid gap-2 lg:grid-cols-[120px_minmax(0,1fr)] lg:items-start rounded-xl border border-border/85 bg-background/45 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">兼容性</div>
              <div>
                Gallery 会按归档记录中的路径元数据定位文件，因此修改下载目录只影响未来下载。
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">当前页面未暴露更多桌面控制项。</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
          <li>文件命名规则和并发下载数仍沿用后端默认值。</li>
          <li>缓存大小、缓存清理和 SQLite 状态暂未暴露。</li>
          <li>API 连通性测试和检查更新当前不在此页面提供。</li>
        </ul>
      </div>
    </SettingsPanel>
  );
}
