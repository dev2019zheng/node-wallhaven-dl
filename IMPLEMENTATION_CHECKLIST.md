# Wallhaven Desktop Implementation Checklist

> 本文档用于跟踪桌面应用从骨架到可用功能的实现进度。每完成一个子任务，立即更新勾选状态。

## 当前里程碑：让 Search 成为第一个真实可用页面
- [x] 1.1 实现 Search 应用层与仓储适配
- [x] 1.2 实现 Search 页面真实表单
- [x] 1.3 渲染 Search 结果网格
- [x] 1.4 接入大图预览

## 后续里程碑：下载闭环
- [x] 2.1 实现 Rust download command
- [x] 2.2 补下载事件流
- [x] 2.3 实现 DownloadsPage

## 后续里程碑：归档与图库
- [x] 3.1 接入 Tauri SQL + SQLite migration
- [x] 3.2 用 SQLite 替换 ArchiveStore 内存实现
- [x] 4.1 实现图库查询 command
- [x] 4.2 实现 GalleryPage

## 后续里程碑：设置增强
- [x] 5.1 支持自定义下载目录
- [x] 5.2 补设置页真实错误与状态提示
