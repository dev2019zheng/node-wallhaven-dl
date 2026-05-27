你是一个资深 Tauri + React + TypeScript 桌面应用开发 Agent。请基于现有 Wallhaven Desktop 项目，按照新版 PRD 重构 UI 与交互，不要破坏现有搜索、下载、图库、设置等后端能力。

产品目标：
UX设计图在 @specs/prd.png，
构建一个现代化、稳定、清晰的 Wallhaven 壁纸下载器桌面端，核心场景包括：
1. 搜索 Wallhaven 壁纸
2. 多条件筛选与分页浏览
3. 单张 / 批量下载
4. 下载任务队列管理
5. 本地图库归档浏览
6. 设置 API Key、下载目录、代理、缓存等

技术要求：
- 框架：Tauri + React + TypeScript
- 样式：Tailwind CSS 或现有样式系统
- 状态管理：优先使用 Zustand / React Context，避免过度工程化
- 动画：Framer Motion 或 CSS transition
- 数据持久化：沿用现有 Tauri Store / SQLite / Rust command
- 不要重写后端能力，优先复用已有 command
- 保持深色主题为默认主题，支持浅色主题切换

整体 UI 风格：
- 深色、克制、现代、偏专业工具感
- 主色：蓝色，用于主按钮、选中态、进度条
- 辅助色：绿色表示成功，红色表示错误，黄色表示警告
- 大圆角卡片，细边框，轻微阴影
- 字体建议使用 Inter / system font
- 主界面需要有明显的信息层级，不要把所有控件堆成“设置页受刑现场”

应用结构：
左侧固定 Sidebar：
- Logo + Wallhaven Desktop
- Search 搜索
- Downloads 下载
- Gallery 图库
- Settings 设置
- Favorites / Collections 收藏与分类，可作为扩展项
- 当前下载统计和状态小组件

顶部栏：
- 全局搜索输入框
- 主题切换按钮
- 设置入口
- API 连接状态
- 当前任务状态提示

页面一：Search / 搜索页
核心布局：
- 顶部搜索输入框，支持关键词、分辨率、颜色、比例等查询
- 筛选区使用紧凑 chip / dropdown：
  - Category：All / General / Anime / People
  - Purity：SFW / Sketchy / NSFW，如果无权限则禁用 NSFW
  - Sorting：Toplist / Date added / Relevance / Random / Views / Favorites
  - Toplist Range：1d / 3d / 1w / 1m / 3m / 6m / 1y
  - Resolution / Ratio / Color
  - Page
  - Pages to download
- 搜索结果使用瀑布流或三列网格卡片
- 每张壁纸卡片显示：
  - 缩略图
  - 分辨率
  - 比例
  - 收藏按钮
  - 下载按钮
  - 预览按钮
  - 选中态 checkbox
- 支持多选
- 底部 sticky action bar：
  - 已选择数量
  - 下载选中
  - 批量下载当前查询
  - 清除选择

交互状态：
- 默认状态：展示推荐或上次查询
- Loading：骨架屏，不要空白
- Empty：说明无结果，并提供重置筛选按钮
- Error：显示错误原因和重试按钮
- Hover：图片轻微放大，操作按钮浮现
- Selected：蓝色描边 + checkbox

页面二：Downloads / 下载页
核心布局：
- 顶部 tabs：
  - 全部
  - 下载中
  - 已完成
  - 失败
- 下载任务列表：
  - 缩略图
  - 文件名
  - Wallpaper ID
  - 保存路径
  - 当前进度
  - 下载速度
  - 状态 badge
  - 操作按钮：暂停、继续、重试、打开文件、删除任务
- 顶部提供：
  - 全部暂停
  - 全部继续
  - 清理已完成
  - 重试失败

状态设计：
- Queued：灰色
- Downloading：蓝色进度条
- Completed：绿色
- Failed：红色，显示失败原因
- Paused：黄色

动画：
- 新任务插入列表时淡入 + 轻微上移
- 进度条平滑过渡
- 状态切换使用 150-250ms transition

页面三：Gallery / 本地图库
核心布局：
- 左侧分类 / 收藏夹
- 顶部搜索本地文件
- 支持网格视图 / 紧凑视图切换
- 支持按时间、分辨率、文件大小、收藏排序
- 图片卡片显示：
  - 缩略图
  - 分辨率
  - 文件大小
  - 下载时间
  - 收藏按钮
  - 打开文件
  - 在 Finder 中显示
  - 删除
- 支持多选和批量操作

空状态：
- 未找到图库文件时显示插画式空状态
- 提供“前往搜索下载壁纸”按钮

页面四：Settings / 设置页
分组展示，不要做成一堵表单墙：
1. Wallhaven Access
   - API Key 输入框，默认隐藏
   - 保存 / 清空
   - 连接测试状态
2. Download Settings
   - 下载目录
   - 默认批量下载页数
   - 文件命名规则，例如 wallhaven-{id}.{ext}
   - 并发下载数
3. Network
   - 代理类型
   - 代理地址
   - 测试连接
4. Storage
   - 缓存大小
   - 清理缓存
   - SQLite 数据库状态
5. About
   - 版本号
   - 检查更新

交互与动画要求：
- 页面切换：轻微 fade + slide，持续 180ms
- Modal：缩放 0.98 到 1 + fade
- Toast：
  - 下载完成
  - 保存设置成功
  - 网络失败
  - API Key 无效
- Tooltip：
  - 图标按钮必须有说明
- 确认弹窗：
  - 删除文件
  - 清空任务
  - 清除 API Key

重要组件：
请实现或重构以下组件：
- AppShell
- Sidebar
- TopBar
- SearchFilters
- WallpaperGrid
- WallpaperCard
- DownloadQueue
- DownloadTaskCard
- GalleryGrid
- GalleryCard
- SettingsPanel
- EmptyState
- ErrorState
- LoadingSkeleton
- ToastProvider
- ConfirmDialog

视觉规范：
- Border radius：12px / 16px
- 页面 padding：24px
- 卡片间距：16px
- Sidebar 宽度：220px 左右
- 主按钮高度：40px
- 图片卡片比例：16:9 或根据图片真实比例自适应
- 深色背景层级：
  - App background：#0B0F14
  - Panel：#111821
  - Card：#151D27
  - Border：#263241
  - Primary：#1E9BFF
  - Success：#2ECC71
  - Danger：#FF5C5C
  - Text primary：#F4F7FA
  - Text secondary：#9AA7B2

开发优先级：
P0：
- AppShell / Sidebar / TopBar
- Search 页新版布局
- 下载任务队列新版布局
- Gallery 网格新版布局
- Settings 分组新版布局

P1：
- 多选下载
- Toast
- Confirm Dialog
- Empty / Error / Loading 状态
- 主题切换

P2：
- 收藏夹
- 高级筛选
- 本地图片标签
- 快捷键
- 导入 / 导出设置

验收标准：
- 所有现有功能仍可使用
- 页面切换无明显卡顿
- 搜索结果、下载任务、图库均有 loading / empty / error 状态
- 下载进度能实时更新
- 设置保存后能即时反馈
- UI 在 1440px、1728px、1920px 宽度下都可正常显示
- 不出现硬编码假数据污染真实数据流
- Mock 数据只能用于 Storybook / dev mode

请先阅读现有项目结构，识别前端组件、Tauri commands、状态管理方式，再制定实现计划。然后按 P0 到 P2 分阶段修改代码。每完成一个阶段，输出变更摘要、涉及文件、潜在风险和下一步建议。