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

`.github/workflows/release-tauri.yml` builds and publishes desktop installers for macOS, Linux, and Windows.

- Pushing to `master` creates or updates the rolling `nightly` prerelease. This release reuses one `nightly` tag and replaces its assets on each successful master build, so the Releases page does not get a new entry for every merge.
- Pushing a tag that starts with `v` creates or updates the matching stable GitHub Release and uploads the platform installers to that release.
- GitHub treats prereleases separately from the stable Latest release. The `nightly` prerelease is a moving preview build, not the stable Latest release.

Current CI artifacts are unsigned. macOS Gatekeeper and Windows SmartScreen may warn on first launch until code signing and notarization are configured.

Local macOS DMG verification uses the same wrapper script as CI:

```bash
npm run tauri:build:dmg
```

## Legacy CLI reference

The original Node CLI downloader remains available for migration work:

```bash
npm run legacy:cli
```
