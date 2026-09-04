# Page i18n patches

Apply on `feat/i18n-zh-en-toggle`:

```bash
git apply patches/DownloadsPage.tsx.i18n.patch
git apply patches/GalleryPage.tsx.i18n.patch
git apply patches/SearchPage.tsx.i18n.patch
git apply patches/SettingsPage.tsx.i18n.patch
bun install
bun run typecheck && bun run test:run
```
