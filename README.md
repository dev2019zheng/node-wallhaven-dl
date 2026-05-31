# Wallhaven Desktop

This repository is now set up as a **Tauri v2 + React + TypeScript** desktop application scaffold for the Wallhaven downloader project.

## Current scaffold

- React + Vite + TypeScript frontend app shell
- Tailwind CSS + shadcn/ui-ready foundation
- Feature placeholders for Search / Downloads / Gallery / Settings
- Vitest + React Testing Library baseline test coverage
- Tauri v2 Rust shell under `src-tauri/`
- Legacy Node CLI preserved in `index.js` for migration reference

## Development commands

```bash
npm install
npm run dev
npm run test -- --run
npm run build
npm run tauri dev
npm run tauri:build:dmg
```

## Release automation

Pushing a tag that starts with `v` triggers `.github/workflows/release-tauri.yml` to build platform installers and upload them to the matching GitHub Release page.

Local macOS DMG verification uses the same wrapper script as CI:

```bash
npm run tauri:build:dmg
```

## Legacy CLI reference

The original Node CLI downloader remains available for migration work:

```bash
npm run legacy:cli
```
