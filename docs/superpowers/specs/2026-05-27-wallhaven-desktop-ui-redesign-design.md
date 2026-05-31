# Wallhaven Desktop UI Redesign Design

## Goal

基于现有 Tauri + React + TypeScript 桌面端实现，按新版 PRD 重构前端壳层、页面布局与交互反馈，同时保持现有 Search、Downloads、Gallery、Settings 的后端能力与数据链路可用。

这次设计优先解决信息架构、跨页 UI 协议和组件边界，不重写 Rust command、Tauri repository、application service 或存储实现。

## Scope

### In scope

- 新版 AppShell、Sidebar、TopBar 和页面容器协议
- Search、Downloads、Gallery、Settings 四页的信息层级重构
- 薄 Zustand UI 状态层，用于跨页 UI 状态
- 统一的 Empty / Error / Loading / Toast / Confirm Dialog 协议
- 深色主题默认、浅色主题切换、视觉 token 收敛
- 按 P0 / P1 / P2 拆分实施顺序与风险控制

### Out of scope

- 重写或替换现有 Rust command、SQLite、Tauri Store、下载管理实现
- 在 P0 阶段引入 Favorites / Collections、本地标签、快捷键、设置导入导出
- 为了视觉重构而改写现有业务契约
- 在生产数据流中引入硬编码 mock 数据

## Current state findings

### Frontend structure

- 路由使用 `HashRouter`，入口在 `src/App.tsx`。
- 现有壳层在 `src/components/app-shell.tsx`，但仍是顶部导航壳，不是 PRD 需要的固定 Sidebar + TopBar 结构。
- 页面分为四个主入口：
  - `src/features/search/SearchPage.tsx`
  - `src/features/downloads/DownloadsPage.tsx`
  - `src/features/gallery/GalleryPage.tsx`
  - `src/features/settings/SettingsPage.tsx`
- 没有全局 store。状态主要分散在各页面的 `useState`、`useEffect`、`react-hook-form` 中。
- Search 页还使用模块级 session snapshot 保留页面状态：`src/features/search/search-page-session.ts`。

### Reusable frontend assets

- Search 已有真实筛选、结果网格、预览灯箱和下载入口：
  - `src/features/search/components/SearchResultGrid.tsx`
  - `src/features/search/components/SearchResultCard.tsx`
  - `src/features/search/components/SearchPreviewLightbox.tsx`
- Gallery 已有本地图网格与预览灯箱：
  - `src/features/gallery/components/GalleryGrid.tsx`
  - `src/features/gallery/components/GalleryPreviewLightbox.tsx`
- Theme 已接入 `next-themes`：
  - `src/components/theme-provider.tsx`
  - `src/components/theme-toggle.tsx`
- 现有 `src/styles/index.css` 已具备 token 化主题基础，但视觉层级还未对齐新版 PRD。

### Existing backend boundaries that must stay stable

- Search：`search_wallpapers`
- Downloads：`download_wallpaper`、`list_downloads`
- Download events：`downloads:status`、`downloads:progress`
- Gallery：`list_gallery_items`
- Settings：
  - `get_download_directory_settings`
  - `save_download_directory_settings`
  - `get_network_proxy_settings`
  - `save_network_proxy_settings`
  - `wallhavenKey` 通过前端 Tauri Store 持久化

### Main problems to solve

- `SearchPage` 过胖，页面同时承担表单、结果、下载反馈和批量逻辑，后续继续堆功能会失控。
- 现有壳层无法承接新版 PRD 中的 Sidebar、TopBar、下载摘要、全局状态提示。
- 页面级 loading / empty / error / success 反馈不统一。
- 跨页 UI 状态缺少稳定落点，后续多选下载、顶部任务提示、全局 toast 会继续散在页面中。

## Design decisions

### 1. Use the shell-first route

优先选择“统一新壳优先”的路线，而不是先做单页局部冲刺。

理由：

- 新版 PRD 的最大变化是壳层和信息架构，不是单一页面控件。
- 先稳定 AppShell，后续 P1 / P2 组件复用率更高。
- 保持现有后端能力不动的前提下，先整理 UI 容器边界，能降低返工概率。

### 2. Introduce a thin Zustand UI store

新增一层很薄的 Zustand store，只承接跨页 UI 状态，不承接业务数据。

适合进入 store 的状态：

- Sidebar / TopBar 的展示状态
- 下载摘要和当前任务提示
- Toast 队列
- Confirm Dialog 开关和上下文
- Search 多选的选中 ID
- Gallery 视图偏好和局部展示偏好

不进入 store 的状态：

- Search 结果数据
- Downloads 原始任务列表
- Gallery 原始数据
- Settings 表单值

这些业务状态仍保留在各页面 local state，并继续通过 application service 和 infrastructure repository 与 Tauri 通信。

### 3. Keep the current business chain intact

前端与 Rust 的主链路保持不变：

`Page → application service → Tauri repository / event adapter → Rust command / event`

这次设计不允许页面直接 `invoke` Rust command，也不允许壳层越过 service 直接操作 repository。

### 4. Reuse proven view patterns

- Search 和 Gallery 继续沿用“卡片网格 + 预览灯箱”的工作模式
- Downloads 继续沿用“事件流驱动列表”的工作模式
- Settings 继续沿用“聚合 service + 表单”模式

变化点在于：这些能力会被放进新的壳层协议和更清晰的组件边界中。

## Shell architecture

### AppShell responsibilities

新的 `AppShell` 负责以下内容：

- 左侧固定 Sidebar
- 顶部固定 TopBar
- 主内容容器与页面 padding
- 页面切换动效容器
- 全局反馈层：ToastProvider、ConfirmDialog
- 将下载摘要、API 状态、主题入口与全局搜索入口固定在壳层

`AppShell` 不直接持有业务数据，只消费 UI store 的跨页状态，并渲染页面内容插槽。

### Sidebar responsibilities

Sidebar 采用固定宽度，目标宽度约 220px。内容包含：

- Logo + Wallhaven Desktop 标识
- Search / Downloads / Gallery / Settings 主导航
- Favorites / Collections 预留入口
- 下载状态小组件

Sidebar 只展示导航与摘要，不承担页面级业务控件。

### TopBar responsibilities

TopBar 固定存在，不与页面头部抢角色。它承接：

- 全局搜索入口
- 主题切换
- 设置快捷入口
- API 状态
- 当前任务状态提示

全局搜索入口的行为定义为：

- 在 Search 页中，它与 `SearchFilters` 的关键词输入共享同一个查询值
- 在非 Search 页中提交关键词时，跳转到 Search 页并写入查询值
- 它是搜索入口，不承接分辨率、比例、颜色等高级筛选

设计约束：

- TopBar 负责“全局上下文”
- 各页面头部负责“当前工作区语义”
- Search 页内部只保留页面级筛选与结果区，不再额外制造第二个全局语义入口

这样能避免 Search 页标题区和 TopBar 重复表达同一层信息。

## Visual system

### Theme direction

- 深色主题为默认主题
- 保留浅色主题切换
- 沿用现有 `next-themes` 方案
- 将现有 token 对齐到 PRD 指定的视觉层级

### Core tokens

- App background：`#0B0F14`
- Panel：`#111821`
- Card：`#151D27`
- Border：`#263241`
- Primary：`#1E9BFF`
- Success：`#2ECC71`
- Danger：`#FF5C5C`
- Text primary：`#F4F7FA`
- Text secondary：`#9AA7B2`

### Layout tokens

- 页面 padding：24px
- 卡片间距：16px
- Sidebar 宽度：约 220px
- 主按钮高度：40px
- 基础圆角：12px / 16px

### Motion rules

- 页面切换：fade + slight slide，180ms
- Modal / Confirm Dialog：scale `0.98 → 1` + fade
- 下载进度条：150-250ms 宽度过渡
- 图片卡 hover：轻微放大 + 操作按钮浮现

## Component architecture

### Shell layer

建议新增或重构以下壳层组件：

- `AppShell`
- `Sidebar`
- `TopBar`
- `ToastProvider`
- `ConfirmDialog`

### Search page

建议将当前 Search 页拆成以下职责单元：

- `SearchFilters`
- `WallpaperGrid`
- `WallpaperCard`
- `StickySelectionBar`
- `SearchPreviewLightbox`（保留并适配新样式）

设计意图：

- `SearchPage` 退回为页面编排器
- 表单、结果网格、单卡片、批量操作条各自独立
- 批量逻辑和多选逻辑不再混杂在一个大页面里

### Downloads page

建议拆分为：

- `DownloadQueue`
- `DownloadTaskCard`
- `QueueTabs`
- `QueueToolbar`

Downloads 页仍由事件流驱动，但页面本身只负责组合 tabs、列表和工具条。

### Gallery page

建议拆分为：

- `GallerySidebar`
- `GalleryToolbar`
- `GalleryGrid`
- `GalleryCard`
- `GalleryPreviewLightbox`（保留并适配新样式）

### Settings page

建议抽出：

- `SettingsPanel`
- `WallhavenAccessCard`
- `DownloadSettingsCard`
- `NetworkCard`
- `StorageCard`
- `AboutCard`

Settings 页不再是一整块表单墙，而是以分组卡片承接现有设置能力。

### Shared UI

统一补齐以下跨页组件：

- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `ToastProvider`
- `ConfirmDialog`

这些组件不承载业务逻辑，只承载统一反馈协议与视觉表达。

## State and data flow

### Cross-page UI state

建议新建 `uiShellStore`，只管理以下状态：

- 顶部任务摘要
- 下载数量摘要
- Toast 队列
- Confirm dialog 状态
- Search 选中 ID
- Gallery 视图模式和局部偏好

### Page local state

各页保留自己的业务状态：

- Search：筛选表单、结果、灯箱、批量下载进度文案
- Downloads：任务列表、tab 过滤、局部错误状态
- Gallery：本地搜索、排序、分页或视图切换状态
- Settings：表单值、保存反馈、局部加载状态

### Download status propagation

Downloads 页仍是下载事件的主消费方：

- `downloads:status`
- `downloads:progress`

Downloads 页在合并任务状态后，再同步导出壳层可消费的摘要信息给 TopBar / Sidebar。

这样可以避免 TopBar 和 Downloads 页同时独立消费底层事件，导致状态双写和不一致。

## Page contracts

### Search

目标：成为明确的“搜索工作台”。

结构：

1. 页面头部：当前查询语义、统计提示
2. TopBar 全局搜索入口：承接关键词输入
3. 筛选区：紧凑 chip / dropdown
4. 结果区：三列卡片网格
5. 底部 sticky action bar：多选下载、批量下载、清除选择

筛选区至少覆盖以下字段：

- Category：All / General / Anime / People
- Purity：SFW / Sketchy / NSFW
- Sorting：Toplist / Date added / Relevance / Random / Views / Favorites
- Toplist Range：1d / 3d / 1w / 1m / 3m / 6m / 1y
- Resolution / Ratio / Color
- Page
- Pages to download

卡片至少承载以下内容与动作：

- 缩略图
- 分辨率
- 比例
- 收藏按钮
- 下载按钮
- 预览按钮
- 选中态 checkbox

交互约束：

- 结果为空时提供重置筛选入口
- loading 时显示骨架屏，不留空白
- 多选态只作用于当前结果集
- 当前结果集变化后，旧的选中集清空，避免批量操作误打到新结果

P0 重点：

- 页面头部重排
- 筛选区 compact 化
- 结果区和操作区信息层级拉开

P1 重点：

- 多选与 sticky action bar
- 统一 loading / empty / error
- toast 接入

### Downloads

目标：成为明确的“任务队列页”。

结构：

1. 页面头部：队列摘要
2. Tabs：全部 / 下载中 / 已完成 / 失败
3. Toolbar：全部暂停、全部继续、清理已完成、重试失败
4. 列表区：任务卡片

任务卡片至少承载以下字段与动作：

- 缩略图
- 文件名
- Wallpaper ID
- 保存路径
- 当前进度
- 下载速度
- 状态 badge
- 暂停、继续、重试、打开文件、删除任务

状态表达至少覆盖：

- Queued
- Downloading
- Completed
- Failed
- Paused

交互约束：

- 进度更新来自现有下载事件链路
- 顶部摘要只消费聚合结果，不直接消费底层事件
- 失败任务需要展示失败原因

P0 重点：

- 列表信息结构化
- 状态 badge、进度条、主要动作位置固定

P1 重点：

- Toolbar 真正接入动作
- 统一 confirm / toast / error feedback

### Gallery

目标：成为明确的“本地图库工作台”。

结构：

1. 左侧分类 / 收藏夹栏
2. 顶部工具条：本地搜索、排序、视图切换
3. 主区：网格 / 紧凑视图
4. 空态：前往搜索下载壁纸

顶部工具条至少覆盖：

- 本地搜索
- 按时间、分辨率、文件大小、收藏排序
- 网格视图 / 紧凑视图切换

卡片至少承载以下内容与动作：

- 缩略图
- 分辨率
- 文件大小
- 下载时间
- 收藏按钮
- 打开文件
- 在 Finder 中显示
- 删除

交互约束：

- 空态提供前往 Search 的明确动作
- 现有本地图片渲染继续通过 Tauri asset protocol
- 预览灯箱能力继续保留

P0 重点：

- 布局重排
- 分类栏与工具条分离
- 卡片信息结构化

P1 重点：

- 统一空态 / 错态 / loading
- 多选和批量操作预留协议

### Settings

目标：从表单页重构为“分组设置页”。

结构：

- Wallhaven Access
- Download Settings
- Network
- Storage
- About

各组至少覆盖以下字段：

- Wallhaven Access：API Key 输入、保存、清空、连接状态
- Download Settings：下载目录、默认批量下载页数、文件命名规则、并发下载数
- Network：代理类型、代理地址、测试连接
- Storage：缓存大小、清理缓存、SQLite 状态
- About：版本号、检查更新

交互约束：

- 继续沿用现有 settings-service 聚合加载与保存
- API Key 默认隐藏
- 删除 API Key、清理缓存等危险动作接入统一 confirm dialog

P0 重点：

- 分组卡片化
- 右侧摘要区承接即时状态

P1 重点：

- toast、confirm、统一错误反馈
- 主题切换在新壳内统一承接

## Shared feedback contract

四个页面统一接入以下状态协议：

- Loading：骨架屏或 loading panel，不出现空白页
- Empty：解释原因，并给出下一步动作
- Error：说明错误，并给出重试入口
- Success：通过 toast 或页面级正反馈呈现

Confirm Dialog 统一覆盖：

- 删除文件
- 清空任务
- 清除 API Key

Tooltip 统一覆盖 icon-only 操作按钮。

Toast 至少覆盖以下场景：

- 下载完成
- 保存设置成功
- 网络失败
- API Key 无效

## Phased rollout

### P0

先完成结构稳定性：

- AppShell / Sidebar / TopBar
- Search 页新版布局
- Downloads 队列新版布局
- Gallery 网格新版布局
- Settings 分组新版布局

### P1

再补统一交互闭环：

- 多选下载
- ToastProvider
- ConfirmDialog
- Empty / Error / Loading
- 主题切换与壳层统一

### P2

最后补扩展能力：

- Favorites / Collections
- 高级筛选
- 本地图片标签
- 快捷键
- 导入 / 导出设置

实施顺序必须遵守：

1. 先统一壳层与视觉 token
2. 再拆分四页容器和主要组件
3. 再补 Shared UI 组件
4. 最后补多选、主题和扩展能力

## Risks and mitigations

### Risk 1: SearchPage is too heavy

风险：Search 页当前承担太多责任，视觉重排时最容易把业务逻辑和布局改动混在一起。

应对：

- 优先抽出 `SearchFilters`、`WallpaperGrid`、`StickySelectionBar`
- 页面只保留编排和状态连接职责

### Risk 2: Download summary can desync

风险：如果 TopBar 和 Downloads 页同时直接消费底层下载事件，摘要和详情会出现双写和不同步。

应对：

- Downloads 页继续作为事件主消费方
- TopBar / Sidebar 只读取聚合后的 UI summary

### Risk 3: Settings layout may break save/load feedback

风险：Settings 页重排时可能误伤现有保存、加载、错误反馈路径。

应对：

- 保持 `settings-service` 契约不动
- 优先改容器、分组与视觉层级，不先改业务流程

### Risk 4: TopBar API status can overpromise

风险：现有能力没有独立的 API 连通性测试 command，TopBar 不能伪装成实时健康检查。

应对：

- P0 先展示“已配置 / 未配置”或“可用配置状态”
- 显式连通性测试保留到后续能力增强阶段，或在新增明确 command 后再接入

## Verification requirements for implementation

后续进入实施时，至少要满足以下验证闭环：

### Automated

- `npm run test:run`
- `npm run typecheck`
- `npm run build`

### Manual

- 四页路由切换无明显卡顿
- Search 搜索、单张下载、批量下载不回退
- Downloads 实时进度仍可更新
- Gallery 仍可渲染本地图片和灯箱
- Settings 保存仍即时反馈
- 深色 / 浅色主题切换正常
- 1440 / 1728 / 1920 宽度下页面可用

### Data safety

- 不引入生产路径 mock 数据
- 不破坏现有 command 名称、事件名称和字段结构
- 不让页面绕过 service / repository 直连 Rust

## Final recommendation

采用 A 路线，也就是“统一新壳优先”。

先把 AppShell、页面协议和跨页 UI 状态稳定下来，再按 P0 / P1 / P2 逐层补齐功能。这样既能贴近新版 PRD，又不会破坏已经打通的 Search、Downloads、Gallery、Settings 后端能力闭环。