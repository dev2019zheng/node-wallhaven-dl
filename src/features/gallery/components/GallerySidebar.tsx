import type { GalleryView } from "@/features/shell/ui-shell-store"

type GallerySidebarProps = {
  archivedCount: number
  loadedCount: number
  visibleCount: number
  view: GalleryView
  hasActiveSearch: boolean
}

export function GallerySidebar({
  archivedCount,
  loadedCount,
  visibleCount,
  view,
  hasActiveSearch,
}: GallerySidebarProps) {
  return (
    <aside aria-label="Gallery sidebar" className="app-panel space-y-4 border-border/90 p-4 lg:p-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">本地图库</h3>
        <p className="text-sm text-muted-foreground">聚合已归档壁纸，并保留当前设备上的检索与预览入口。</p>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-border/85 bg-background/35 p-3">
        <div className="flex items-center justify-between rounded-xl bg-primary/12 px-3 py-2 text-sm text-foreground shadow-[inset_0_0_0_1px_rgb(30_155_255_/_0.16)]">
          <span>全部壁纸</span>
          <span className="text-xs font-semibold text-primary">{visibleCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground">
          <span>已归档</span>
          <span className="text-xs font-medium">{archivedCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground">
          <span>当前已载入</span>
          <span className="text-xs font-medium">{loadedCount}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground">
          <span>视图模式</span>
          <span className="text-xs font-medium">{view === "grid" ? "网格" : "紧凑"}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground">
          <span>本地搜索</span>
          <span className="text-xs font-medium">{hasActiveSearch ? "已启用" : "未启用"}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/85 bg-background/35 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">当前信息</p>
        <p className="mt-2 leading-6">
          图库卡片当前展示文件名、保存路径、来源链接与归档时间。更多文件元数据仍取决于
          Gallery command 返回的字段。
        </p>
      </div>
    </aside>
  )
}
