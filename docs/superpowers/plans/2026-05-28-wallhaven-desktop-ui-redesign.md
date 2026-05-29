# Wallhaven Desktop UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved shell-first redesign for Wallhaven Desktop without breaking the existing Search, Downloads, Gallery, and Settings backend flows.

**Architecture:** Introduce a thin Zustand UI store for cross-page UI state, keep page business state local, and preserve the current `page -> application service -> infrastructure repository -> Tauri command/event` chain. Land P0 first (shell + four page layouts), then layer shared feedback, theme integration, and multiselect on top.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Zustand, React Hook Form, Tailwind CSS 4, Vitest, Tauri v2.

---

## Capability constraints you must respect

The current repo does **not** have backend support for every control shown in the PRD. Do not fake these features in the implementation.

**Backed by current commands/events:**
- Search by keyword/category/purity/sorting/toplist/page
- Single download and query-wide download
- Download list + live `downloads:status` / `downloads:progress`
- Gallery list from SQLite archive
- Wallhaven key, download directory, and proxy settings
- Theme switching via `next-themes`

**Not backed by current commands/events:**
- Download pause/resume/retry/delete/open file actions
- Gallery delete/open in Finder/file-size metadata/resolution metadata/favorites persistence
- Search resolution/ratio/color filters and the extra sort modes from the PRD
- Settings file naming rule, concurrency, cache size/clear cache, SQLite status, API connectivity test, update checks
- Favorites/Collections persistence, local tags, import/export settings

**Rule:** For backend-dependent PRD items, either omit them from the live UI for now or render them as clearly disabled affordances with explanatory copy. Do not create fake success paths.

## File structure map

### Shell and shared UI
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/styles/index.css`
- Create: `src/features/shell/ui-shell-store.ts`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/top-bar.tsx`
- Create: `src/components/empty-state.tsx`
- Create: `src/components/error-state.tsx`
- Create: `src/components/loading-skeleton.tsx`
- Create: `src/components/toast-provider.tsx`
- Create: `src/components/confirm-dialog.tsx`

### Search
- Modify: `src/features/search/SearchPage.tsx`
- Modify: `src/features/search/SearchPage.test.tsx`
- Modify: `src/features/search/search-page-session.ts`
- Create: `src/features/search/components/SearchFilters.tsx`
- Create: `src/features/search/components/WallpaperGrid.tsx`
- Create: `src/features/search/components/WallpaperCard.tsx`
- Create: `src/features/search/components/StickySelectionBar.tsx`
- Keep: `src/features/search/components/SearchPreviewLightbox.tsx`

### Downloads
- Modify: `src/features/downloads/DownloadsPage.tsx`
- Modify: `src/features/downloads/DownloadsPage.test.tsx`
- Modify: `src/application/downloads/downloads-service.ts`
- Create: `src/features/downloads/components/QueueTabs.tsx`
- Create: `src/features/downloads/components/DownloadQueue.tsx`
- Create: `src/features/downloads/components/DownloadTaskCard.tsx`

### Gallery
- Modify: `src/features/gallery/GalleryPage.tsx`
- Modify: `src/features/gallery/GalleryPage.test.tsx`
- Modify: `src/features/gallery/components/GalleryGrid.tsx`
- Create: `src/features/gallery/components/GallerySidebar.tsx`
- Create: `src/features/gallery/components/GalleryToolbar.tsx`
- Create: `src/features/gallery/components/GalleryCard.tsx`
- Keep: `src/features/gallery/components/GalleryPreviewLightbox.tsx`

### Settings
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Create: `src/features/settings/components/SettingsPanel.tsx`
- Create: `src/features/settings/components/WallhavenAccessCard.tsx`
- Create: `src/features/settings/components/DownloadSettingsCard.tsx`
- Create: `src/features/settings/components/NetworkCard.tsx`
- Create: `src/features/settings/components/StorageAboutCard.tsx`

---

## Phase P0 — Shell and page layout rewrite

### Task 1: Build the new shell and thin UI store

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/styles/index.css`
- Create: `src/features/shell/ui-shell-store.ts`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/top-bar.tsx`

- [ ] **Step 1: Write the failing shell test**

```tsx
import { render, screen, waitFor } from "@testing-library/react";

import App from "./App";

it("renders persistent shell chrome around the routed search page", async () => {
  render(<App />);

  await waitFor(() => {
    expect(window.location.hash).toBe("#/search");
  });

  expect(screen.getByRole("complementary", { name: /sidebar/i })).toBeInTheDocument();
  expect(screen.getByRole("banner", { name: /top bar/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /search/i })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `npm run test:run -- src/App.test.tsx`
Expected: FAIL because the current `AppShell` does not render `sidebar` / `top bar` landmarks.

- [ ] **Step 3: Add Zustand and create the thin shell store**

Run: `npm install zustand`

Create `src/features/shell/ui-shell-store.ts`:

```ts
import { create } from "zustand";

type DownloadSummary = {
  activeCount: number;
  completedCount: number;
  failedCount: number;
};

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm?: () => void;
};

type UiShellState = {
  globalQuery: string;
  selectedSearchIds: string[];
  galleryView: "grid" | "compact";
  downloadSummary: DownloadSummary;
  toasts: ToastItem[];
  confirm: ConfirmState;
  setGlobalQuery: (value: string) => void;
  setSelectedSearchIds: (ids: string[]) => void;
  clearSelectedSearchIds: () => void;
  setGalleryView: (view: "grid" | "compact") => void;
  setDownloadSummary: (summary: DownloadSummary) => void;
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
  openConfirm: (next: Omit<ConfirmState, "open">) => void;
  closeConfirm: () => void;
};

export const useUiShellStore = create<UiShellState>((set) => ({
  globalQuery: "",
  selectedSearchIds: [],
  galleryView: "grid",
  downloadSummary: { activeCount: 0, completedCount: 0, failedCount: 0 },
  toasts: [],
  confirm: { open: false, title: "", body: "", confirmLabel: "Confirm" },
  setGlobalQuery: (value) => set({ globalQuery: value }),
  setSelectedSearchIds: (ids) => set({ selectedSearchIds: ids }),
  clearSelectedSearchIds: () => set({ selectedSearchIds: [] }),
  setGalleryView: (galleryView) => set({ galleryView }),
  setDownloadSummary: (downloadSummary) => set({ downloadSummary }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  openConfirm: (next) => set({ confirm: { open: true, ...next } }),
  closeConfirm: () =>
    set({ confirm: { open: false, title: "", body: "", confirmLabel: "Confirm" } }),
}));
```

- [ ] **Step 4: Replace the top-nav shell with Sidebar + TopBar**

Create `src/components/sidebar.tsx`:

```tsx
import { Download, Images, Search, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useUiShellStore } from "@/features/shell/ui-shell-store";
import { cn } from "@/lib/utils";

const items = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const summary = useUiShellStore((state) => state.downloadSummary);

  return (
    <aside aria-label="Sidebar" className="flex min-h-screen flex-col border-r border-border bg-[var(--panel)] px-4 py-4">
      <div className="mb-6 rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Wallhaven Desktop</p>
        <p className="mt-1 text-xs text-muted-foreground">Search, download, and archive wallpapers</p>
      </div>
      <nav aria-label="Primary" className="space-y-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                isActive ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <section className="mt-auto rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Downloads</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div><dt>Active</dt><dd className="mt-1 text-foreground">{summary.activeCount}</dd></div>
          <div><dt>Done</dt><dd className="mt-1 text-foreground">{summary.completedCount}</dd></div>
          <div><dt>Failed</dt><dd className="mt-1 text-foreground">{summary.failedCount}</dd></div>
        </dl>
      </section>
    </aside>
  );
}
```

Create `src/components/top-bar.tsx` and update `src/components/app-shell.tsx`:

```tsx
export function TopBar() {
  const globalQuery = useUiShellStore((state) => state.globalQuery);
  const setGlobalQuery = useUiShellStore((state) => state.setGlobalQuery);
  const summary = useUiShellStore((state) => state.downloadSummary);

  return (
    <header aria-label="Top bar" className="sticky top-0 z-10 border-b border-border bg-[var(--panel)]/90 px-6 py-4 backdrop-blur">
      <div className="grid grid-cols-[minmax(280px,1fr)_auto_auto] items-center gap-3">
        <input
          aria-label="Global wallpaper search"
          value={globalQuery}
          onChange={(event) => setGlobalQuery(event.target.value)}
          className="h-11 rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none"
          placeholder="Search wallpapers"
        />
        <div className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {summary.activeCount > 0 ? `${summary.activeCount} active tasks` : "No active tasks"}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--app-background)] text-foreground">
      <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <main className="flex-1 px-6 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
```

Update `src/styles/index.css`:

```css
:root {
  --app-background: #f3f7fb;
  --panel: #ffffff;
}

.dark {
  --app-background: #0b0f14;
  --panel: #111821;
  --card: #151d27;
  --border: #263241;
}
```

- [ ] **Step 5: Run tests and typecheck for the shell task**

Run: `npm run test:run -- src/App.test.tsx && npm run typecheck`
Expected: PASS for `src/App.test.tsx`; `tsc -b` exits 0.

- [ ] **Step 6: Commit the shell task**

```bash
git add package.json package-lock.json src/main.tsx src/App.test.tsx src/components/app-shell.tsx src/components/sidebar.tsx src/components/top-bar.tsx src/features/shell/ui-shell-store.ts src/styles/index.css
git commit -m "feat: rebuild the desktop shell around sidebar and top bar"
```

### Task 2: Refactor Search into a dedicated workspace layout

**Files:**
- Modify: `src/features/search/SearchPage.tsx`
- Modify: `src/features/search/SearchPage.test.tsx`
- Modify: `src/features/search/search-page-session.ts`
- Create: `src/features/search/components/SearchFilters.tsx`
- Create: `src/features/search/components/WallpaperGrid.tsx`
- Create: `src/features/search/components/WallpaperCard.tsx`
- Test: `src/features/search/SearchPage.test.tsx`

- [ ] **Step 1: Add a failing layout-focused Search test**

```tsx
it("renders dedicated filter and result regions after a successful search", async () => {
  vi.mocked(searchWallpapers).mockResolvedValue(sampleResponse);

  render(<SearchPage />);

  await userEvent.setup().click(screen.getByRole("button", { name: /search wallpapers/i }));

  expect(await screen.findByRole("region", { name: /search filters/i })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /search results/i })).toBeInTheDocument();
  expect(screen.getByText("1966x3000")).toBeInTheDocument();
  expect(screen.getByText("0.66")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Search test to verify it fails**

Run: `npm run test:run -- src/features/search/SearchPage.test.tsx`
Expected: FAIL because the current page has no `search filters` / `search results` regions and no ratio field in the card.

- [ ] **Step 3: Extract `SearchFilters`, `WallpaperGrid`, and `WallpaperCard`**

Create `src/features/search/components/SearchFilters.tsx`:

```tsx
import type { UseFormRegister, UseFormWatch, FieldErrors } from "react-hook-form";

import { Button } from "@/components/ui/button";

import type { SearchFormValues } from "../SearchPage";

export function SearchFilters({
  register,
  watch,
  errors,
  isSubmitting,
  onSubmit,
}: {
  register: UseFormRegister<SearchFormValues>;
  watch: UseFormWatch<SearchFormValues>;
  errors: FieldErrors<SearchFormValues>;
  isSubmitting: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}) {
  const sorting = watch("sorting");

  return (
    <form aria-label="Search filters" className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {/* category / purity / sorting / page / pagesToDownload / q */}
      </div>
      {sorting === "toplist" ? <select aria-label="Toplist range" {...register("topRange")} /> : null}
      {errors.page ? <p role="alert">{errors.page.message}</p> : null}
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Searching..." : "Search wallpapers"}</Button>
    </form>
  );
}
```

Create `src/features/search/components/WallpaperCard.tsx`:

```tsx
export function WallpaperCard({
  wallpaper,
  onDownload,
  onPreview,
  isDownloading,
}: {
  wallpaper: SearchWallpaper;
  onDownload: () => void;
  onPreview: () => void;
  isDownloading: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <button type="button" onClick={onPreview} className="block aspect-[16/10] w-full overflow-hidden bg-background">
        <img alt={`Wallpaper ${wallpaper.id}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" src={wallpaper.thumbs.large} />
      </button>
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">{wallpaper.id}</h4>
            <p className="mt-1 text-xs text-muted-foreground">{wallpaper.resolution} · {wallpaper.ratio}</p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{wallpaper.fileType}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={onDownload} disabled={isDownloading}>{isDownloading ? "Downloading..." : "Download"}</Button>
          <Button type="button" variant="outline" onClick={onPreview}>Preview</Button>
        </div>
      </div>
    </article>
  );
}
```

Create `src/features/search/components/WallpaperGrid.tsx` and update `src/features/search/SearchPage.tsx`:

```tsx
export function WallpaperGrid({ wallpapers, downloadingIds, onDownload }: WallpaperGridProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  return (
    <section aria-label="Search results" className="space-y-4 rounded-3xl border border-border bg-card/60 p-6 shadow-sm">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4">
        {wallpapers.map((wallpaper, index) => (
          <WallpaperCard
            key={wallpaper.id}
            wallpaper={wallpaper}
            isDownloading={downloadingIds.has(wallpaper.id)}
            onDownload={() => onDownload(wallpaper)}
            onPreview={() => {
              setPreviewIndex(index);
              setPreviewOpen(true);
            }}
          />
        ))}
      </div>
      <SearchPreviewLightbox index={previewIndex} onClose={() => setPreviewOpen(false)} onView={setPreviewIndex} open={previewOpen} wallpapers={wallpapers} />
    </section>
  );
}

// SearchPage composition
return (
  <section className="space-y-6">
    <PageHeading ... />
    <SearchFilters ... />
    <WallpaperGrid wallpapers={result?.data ?? []} downloadingIds={downloadingWallpaperIdSet} onDownload={(wallpaper) => void onDownload(wallpaper)} />
  </section>
);
```

- [ ] **Step 4: Run the Search test and the app smoke tests**

Run: `npm run test:run -- src/App.test.tsx src/features/search/SearchPage.test.tsx`
Expected: PASS for both test files.

- [ ] **Step 5: Commit the Search layout refactor**

```bash
git add src/features/search/SearchPage.tsx src/features/search/SearchPage.test.tsx src/features/search/search-page-session.ts src/features/search/components/SearchFilters.tsx src/features/search/components/WallpaperGrid.tsx src/features/search/components/WallpaperCard.tsx
git commit -m "feat: split the search page into shell-aligned workspace components"
```

### Task 3: Rebuild Downloads around queue tabs and task cards

**Files:**
- Modify: `src/features/downloads/DownloadsPage.tsx`
- Modify: `src/features/downloads/DownloadsPage.test.tsx`
- Modify: `src/application/downloads/downloads-service.ts`
- Modify: `src/features/shell/ui-shell-store.ts`
- Create: `src/features/downloads/components/QueueTabs.tsx`
- Create: `src/features/downloads/components/DownloadQueue.tsx`
- Create: `src/features/downloads/components/DownloadTaskCard.tsx`
- Test: `src/features/downloads/DownloadsPage.test.tsx`

- [ ] **Step 1: Add a failing queue-filter test**

```tsx
it("filters the download queue by tab without breaking live status updates", async () => {
  vi.mocked(listDownloads).mockResolvedValue([
    { id: "1", wallpaperId: "wh-1", fileName: "one.jpg", relativeFilePath: "wallpapers/one.jpg", status: "running" },
    { id: "2", wallpaperId: "wh-2", fileName: "two.jpg", relativeFilePath: "wallpapers/two.jpg", status: "failed", failureReason: "timeout" },
  ]);

  render(<DownloadsPage />);

  expect(await screen.findByText("one.jpg")).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: /failed/i }));
  expect(screen.queryByText("one.jpg")).not.toBeInTheDocument();
  expect(screen.getByText("two.jpg")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Downloads test to verify it fails**

Run: `npm run test:run -- src/features/downloads/DownloadsPage.test.tsx`
Expected: FAIL because the current page has no tabs or filtered queue rendering.

- [ ] **Step 3: Add queue tabs, task cards, and shell summary sync**

Update `src/application/downloads/downloads-service.ts`:

```ts
export type DownloadQueueFilter = "all" | "running" | "completed" | "failed";

export function summarizeDownloads(downloads: DownloadListItem[]) {
  return {
    activeCount: downloads.filter((download) => download.status === "queued" || download.status === "running").length,
    completedCount: downloads.filter((download) => download.status === "succeeded" || download.status === "skipped_existing").length,
    failedCount: downloads.filter((download) => download.status === "failed").length,
  };
}

export function filterDownloads(downloads: DownloadListItem[], filter: DownloadQueueFilter) {
  if (filter === "all") return downloads;
  if (filter === "running") return downloads.filter((download) => download.status === "queued" || download.status === "running");
  if (filter === "completed") return downloads.filter((download) => download.status === "succeeded" || download.status === "skipped_existing");
  return downloads.filter((download) => download.status === "failed");
}
```

Create `src/features/downloads/components/QueueTabs.tsx`:

```tsx
export function QueueTabs({ value, onChange }: { value: DownloadQueueFilter; onChange: (value: DownloadQueueFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["all", "running", "completed", "failed"] as const).map((item) => (
        <Button key={item} type="button" variant={value === item ? "default" : "outline"} onClick={() => onChange(item)}>
          {item}
        </Button>
      ))}
    </div>
  );
}
```

Create `src/features/downloads/components/DownloadTaskCard.tsx` and update the page:

```tsx
export function DownloadTaskCard({ download }: { download: DownloadListItem }) {
  const percent = download.totalBytes ? Math.min(100, Math.round((download.downloadedBytes / download.totalBytes) * 100)) : download.status === "succeeded" ? 100 : null;

  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{download.fileName}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{download.relativeFilePath}</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-foreground">{download.status}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">Wallpaper ID: {download.wallpaperId}</div>
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">Progress: {download.downloadedBytes}</div>
      </div>
      {percent !== null ? <div className="mt-4 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} /></div> : null}
      {download.failureReason ? <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{download.failureReason}</p> : null}
    </article>
  );
}

// DownloadsPage additions
const [filter, setFilter] = useState<DownloadQueueFilter>("all");
const setDownloadSummary = useUiShellStore((state) => state.setDownloadSummary);

useEffect(() => {
  setDownloadSummary(summarizeDownloads(downloads));
}, [downloads, setDownloadSummary]);

const visibleDownloads = filterDownloads(downloads, filter);
```

- [ ] **Step 4: Run the Downloads tests and typecheck**

Run: `npm run test:run -- src/features/downloads/DownloadsPage.test.tsx && npm run typecheck`
Expected: PASS for the Downloads test file; `tsc -b` exits 0.

- [ ] **Step 5: Commit the Downloads queue refactor**

```bash
git add src/application/downloads/downloads-service.ts src/features/shell/ui-shell-store.ts src/features/downloads/DownloadsPage.tsx src/features/downloads/DownloadsPage.test.tsx src/features/downloads/components/QueueTabs.tsx src/features/downloads/components/DownloadQueue.tsx src/features/downloads/components/DownloadTaskCard.tsx
git commit -m "feat: reorganize downloads into a filtered task queue"
```

### Task 4: Rebuild Gallery around sidebar, toolbar, and cards

**Files:**
- Modify: `src/features/gallery/GalleryPage.tsx`
- Modify: `src/features/gallery/GalleryPage.test.tsx`
- Modify: `src/features/gallery/components/GalleryGrid.tsx`
- Create: `src/features/gallery/components/GallerySidebar.tsx`
- Create: `src/features/gallery/components/GalleryToolbar.tsx`
- Create: `src/features/gallery/components/GalleryCard.tsx`
- Modify: `src/features/shell/ui-shell-store.ts`
- Test: `src/features/gallery/GalleryPage.test.tsx`

- [ ] **Step 1: Add a failing Gallery toolbar test**

```tsx
it("renders gallery controls for local search and view switching", async () => {
  vi.mocked(loadInitialGalleryItems).mockResolvedValue(sampleResponse);

  render(<GalleryPage />);

  expect(await screen.findByRole("searchbox", { name: /search local gallery/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /grid view/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /compact view/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Gallery test to verify it fails**

Run: `npm run test:run -- src/features/gallery/GalleryPage.test.tsx`
Expected: FAIL because the current page has no local search toolbar or stored view mode.

- [ ] **Step 3: Add Gallery sidebar, toolbar, and card composition**

Create `src/features/gallery/components/GalleryToolbar.tsx`:

```tsx
export function GalleryToolbar({
  search,
  onSearchChange,
  view,
  onViewChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  view: "grid" | "compact";
  onViewChange: (value: "grid" | "compact") => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_120px]">
      <input aria-label="Search local gallery" className="h-11 rounded-2xl border border-border bg-background px-4 text-sm" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search downloaded files" />
      <Button type="button" variant={view === "grid" ? "default" : "outline"} onClick={() => onViewChange("grid")}>Grid view</Button>
      <Button type="button" variant={view === "compact" ? "default" : "outline"} onClick={() => onViewChange("compact")}>Compact view</Button>
    </div>
  );
}
```

Create `src/features/gallery/components/GalleryCard.tsx` and update the page:

```tsx
export function GalleryCard({ item, onPreview, compact }: { item: GalleryGridItem; onPreview: () => void; compact: boolean }) {
  return (
    <article className={cn("overflow-hidden rounded-3xl border border-border bg-card shadow-sm", compact ? "grid grid-cols-[160px_minmax(0,1fr)]" : "") }>
      <button type="button" onClick={onPreview} className={cn("block overflow-hidden bg-background", compact ? "h-full" : "aspect-[4/3]")}>
        <img alt={`Wallpaper ${item.wallpaperId}`} className="h-full w-full object-cover" src={item.assetUrl} />
      </button>
      <div className="space-y-3 p-4">
        <h4 className="text-sm font-semibold text-foreground">{item.fileName}</h4>
        <p className="text-xs text-muted-foreground">{item.relativeFilePath}</p>
        <p className="text-xs text-muted-foreground">Archived at {item.createdAt}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onPreview}>Preview</Button>
          <a className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
        </div>
      </div>
    </article>
  );
}

// GalleryPage additions
const galleryView = useUiShellStore((state) => state.galleryView);
const setGalleryView = useUiShellStore((state) => state.setGalleryView);
const [localSearch, setLocalSearch] = useState("");
const filteredItems = galleryItems.filter((item) => {
  const query = localSearch.trim().toLowerCase();
  return query === "" || item.fileName.toLowerCase().includes(query) || item.wallpaperId.toLowerCase().includes(query) || item.relativeFilePath.toLowerCase().includes(query);
});
```

- [ ] **Step 4: Run the Gallery tests**

Run: `npm run test:run -- src/features/gallery/GalleryPage.test.tsx`
Expected: PASS for the Gallery test file.

- [ ] **Step 5: Commit the Gallery workspace refactor**

```bash
git add src/features/shell/ui-shell-store.ts src/features/gallery/GalleryPage.tsx src/features/gallery/GalleryPage.test.tsx src/features/gallery/components/GalleryGrid.tsx src/features/gallery/components/GallerySidebar.tsx src/features/gallery/components/GalleryToolbar.tsx src/features/gallery/components/GalleryCard.tsx
git commit -m "feat: reorganize the gallery as a searchable local workspace"
```

### Task 5: Split Settings into grouped cards without changing its contract

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Create: `src/features/settings/components/SettingsPanel.tsx`
- Create: `src/features/settings/components/WallhavenAccessCard.tsx`
- Create: `src/features/settings/components/DownloadSettingsCard.tsx`
- Create: `src/features/settings/components/NetworkCard.tsx`
- Create: `src/features/settings/components/StorageAboutCard.tsx`
- Test: `src/features/settings/SettingsPage.test.tsx`

- [ ] **Step 1: Add a failing grouped-card test**

```tsx
it("renders grouped settings regions for access, download settings, and network", async () => {
  vi.mocked(loadSettings).mockResolvedValue(/* existing fixture */);

  render(<SettingsPage />);

  expect(await screen.findByRole("region", { name: /wallhaven access/i })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /download settings/i })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /network/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Settings test to verify it fails**

Run: `npm run test:run -- src/features/settings/SettingsPage.test.tsx`
Expected: FAIL because the current page is one monolithic form section.

- [ ] **Step 3: Extract grouped settings cards and keep `loadSettings` / `saveSettings` unchanged**

Create `src/features/settings/components/WallhavenAccessCard.tsx`:

```tsx
export function WallhavenAccessCard({ register, error }: { register: ReturnType<typeof useForm<SettingsFormValues>>["register"]; error?: string }) {
  return (
    <section aria-label="Wallhaven access" className="rounded-3xl border border-border bg-card/60 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">Wallhaven Access</h3>
      <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="wallhavenKey">Wallhaven API key</label>
      <input id="wallhavenKey" type="password" className="mt-2 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm" {...register("wallhavenKey")} />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
```

Update `src/features/settings/SettingsPage.tsx`:

```tsx
return (
  <section className="space-y-6">
    <PageHeading ... />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      <SettingsPanel>
        <WallhavenAccessCard register={register} error={wallhavenKeyError} />
        <DownloadSettingsCard register={register} error={customDirectoryError} onUseDefaultDirectory={...} />
        <NetworkCard register={register} error={networkProxyAddressError} />
        <StorageAboutCard downloadDirectory={downloadDirectory} loadError={loadError} />
      </SettingsPanel>
      <StorageAboutCard downloadDirectory={downloadDirectory} loadError={loadError} />
    </div>
  </section>
);
```

- [ ] **Step 4: Run the Settings tests and the typecheck**

Run: `npm run test:run -- src/features/settings/SettingsPage.test.tsx && npm run typecheck`
Expected: PASS for the Settings test file; `tsc -b` exits 0.

- [ ] **Step 5: Commit the Settings card split**

```bash
git add src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.test.tsx src/features/settings/components/SettingsPanel.tsx src/features/settings/components/WallhavenAccessCard.tsx src/features/settings/components/DownloadSettingsCard.tsx src/features/settings/components/NetworkCard.tsx src/features/settings/components/StorageAboutCard.tsx
git commit -m "feat: break the settings page into grouped cards"
```

---

## Phase P1 — Shared UI, theme integration, and multiselect

### Task 6: Replace inline feedback blocks with shared UI primitives

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/features/search/SearchPage.tsx`
- Modify: `src/features/downloads/DownloadsPage.tsx`
- Modify: `src/features/gallery/GalleryPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Create: `src/components/empty-state.tsx`
- Create: `src/components/error-state.tsx`
- Create: `src/components/loading-skeleton.tsx`
- Create: `src/components/toast-provider.tsx`
- Create: `src/components/confirm-dialog.tsx`
- Test: `src/features/search/SearchPage.test.tsx`, `src/features/settings/SettingsPage.test.tsx`

- [ ] **Step 1: Add a failing toast test to an existing page**

```tsx
it("emits a toast after settings save succeeds", async () => {
  vi.mocked(loadSettings).mockResolvedValue(existingSettingsFixture);
  vi.mocked(saveSettings).mockResolvedValue(updatedSettingsFixture);

  render(<SettingsPage />);

  await userEvent.setup().click(await screen.findByRole("button", { name: /save settings/i }));

  expect(await screen.findByRole("status")).toHaveTextContent(/settings saved/i);
});
```

- [ ] **Step 2: Run the page tests to verify the shared-feedback assertions fail**

Run: `npm run test:run -- src/features/search/SearchPage.test.tsx src/features/settings/SettingsPage.test.tsx`
Expected: FAIL because toasts and shared status primitives do not exist yet.

- [ ] **Step 3: Create `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ToastProvider`, and `ConfirmDialog`**

Create `src/components/toast-provider.tsx`:

```tsx
import { useEffect } from "react";

import { useUiShellStore } from "@/features/shell/ui-shell-store";

export function ToastProvider() {
  const toasts = useUiShellStore((state) => state.toasts);
  const removeToast = useUiShellStore((state) => state.removeToast);

  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => removeToast(toast.id), 3000));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, removeToast]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-6 top-6 z-50 space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" className="pointer-events-auto rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/error-state.tsx` and use it in pages:

```tsx
export function ErrorState({ title, body, retryLabel, onRetry }: { title: string; body: string; retryLabel?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
      <p className="font-semibold">{title}</p>
      <p className="mt-2">{body}</p>
      {retryLabel && onRetry ? <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>{retryLabel}</Button> : null}
    </div>
  );
}
```

Wire `ToastProvider` and `ConfirmDialog` into `src/main.tsx` / `src/components/app-shell.tsx` and replace inline loading/error/empty blocks in each page with the shared components.

- [ ] **Step 4: Run the shared UI tests**

Run: `npm run test:run -- src/features/search/SearchPage.test.tsx src/features/settings/SettingsPage.test.tsx`
Expected: PASS for both test files.

- [ ] **Step 5: Commit the shared UI layer**

```bash
git add src/main.tsx src/components/app-shell.tsx src/components/empty-state.tsx src/components/error-state.tsx src/components/loading-skeleton.tsx src/components/toast-provider.tsx src/components/confirm-dialog.tsx src/features/search/SearchPage.tsx src/features/downloads/DownloadsPage.tsx src/features/gallery/GalleryPage.tsx src/features/settings/SettingsPage.tsx
git commit -m "feat: unify page feedback with shared UI primitives"
```

### Task 7: Add Search multiselect and sticky selection actions

**Files:**
- Modify: `src/features/search/SearchPage.tsx`
- Modify: `src/features/search/SearchPage.test.tsx`
- Modify: `src/features/shell/ui-shell-store.ts`
- Create: `src/features/search/components/StickySelectionBar.tsx`
- Modify: `src/features/search/components/WallpaperCard.tsx`
- Test: `src/features/search/SearchPage.test.tsx`

- [ ] **Step 1: Add a failing multiselect test**

```tsx
it("shows a sticky selection bar for checked wallpapers and clears it after a new search", async () => {
  vi.mocked(searchWallpapers).mockResolvedValue({
    ...sampleResponse,
    data: [createWallpaper("kxpkmm"), createWallpaper("213edy")],
  });

  render(<SearchPage />);

  await userEvent.setup().click(screen.getByRole("button", { name: /search wallpapers/i }));
  await userEvent.setup().click(await screen.findByRole("checkbox", { name: /select wallpaper kxpkmm/i }));

  expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /download selected/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Search test to verify multiselect is still missing**

Run: `npm run test:run -- src/features/search/SearchPage.test.tsx`
Expected: FAIL because there are no checkboxes or sticky selection actions.

- [ ] **Step 3: Move selected IDs into the shell store and add `StickySelectionBar`**

Update `src/features/shell/ui-shell-store.ts`:

```ts
setSelectedSearchIds: (ids) => set({ selectedSearchIds: ids }),
clearSelectedSearchIds: () => set({ selectedSearchIds: [] }),
```

Update `src/features/search/components/WallpaperCard.tsx`:

```tsx
export function WallpaperCard({ wallpaper, selected, onToggleSelected, ...rest }: WallpaperCardProps) {
  return (
    <article className={cn("overflow-hidden rounded-3xl border bg-card shadow-sm", selected ? "border-primary ring-1 ring-primary/40" : "border-border") }>
      <div className="flex items-center justify-between px-4 pt-4">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" aria-label={`Select wallpaper ${wallpaper.id}`} checked={selected} onChange={onToggleSelected} />
          <span>Select</span>
        </label>
      </div>
      {/* existing card body */}
    </article>
  );
}
```

Create `src/features/search/components/StickySelectionBar.tsx`:

```tsx
export function StickySelectionBar({ count, onClear, onDownloadSelected }: { count: number; onClear: () => void; onDownloadSelected: () => void }) {
  return (
    <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-primary/40 bg-[var(--panel)] px-4 py-3 shadow-xl">
      <p className="text-sm font-medium text-foreground">{count} selected</p>
      <div className="flex gap-2">
        <Button type="button" onClick={onDownloadSelected}>Download selected</Button>
        <Button type="button" variant="outline" onClick={onClear}>Clear selection</Button>
      </div>
    </div>
  );
}
```

Update `src/features/search/SearchPage.tsx` to clear selected IDs after a new result set arrives and to bulk-download the selected cards with the existing `downloadWallpaper` service.

- [ ] **Step 4: Run the Search test and the page smoke tests**

Run: `npm run test:run -- src/App.test.tsx src/features/search/SearchPage.test.tsx`
Expected: PASS for both files.

- [ ] **Step 5: Commit the multiselect work**

```bash
git add src/features/shell/ui-shell-store.ts src/features/search/SearchPage.tsx src/features/search/SearchPage.test.tsx src/features/search/components/WallpaperCard.tsx src/features/search/components/StickySelectionBar.tsx
git commit -m "feat: add multiselect actions to the search workspace"
```

---

## Final verification task

### Task 8: Verify the redesigned shell and page flows end-to-end

**Files:**
- Modify as needed from previous tasks
- Test: `src/App.test.tsx`, `src/features/search/SearchPage.test.tsx`, `src/features/downloads/DownloadsPage.test.tsx`, `src/features/gallery/GalleryPage.test.tsx`, `src/features/settings/SettingsPage.test.tsx`

- [ ] **Step 1: Run the focused frontend suite**

Run: `npm run test:run -- src/App.test.tsx src/features/search/SearchPage.test.tsx src/features/downloads/DownloadsPage.test.tsx src/features/gallery/GalleryPage.test.tsx src/features/settings/SettingsPage.test.tsx`
Expected: PASS for all five files.

- [ ] **Step 2: Run typecheck and production build**

Run: `npm run typecheck && npm run build`
Expected: both commands exit 0.

- [ ] **Step 3: Launch the desktop app for manual verification**

Run: `npm run tauri:dev`
Expected: the desktop shell boots with the new Sidebar + TopBar layout.

Manual checklist:
- Search still submits real queries and starts downloads.
- Downloads still receives live progress updates.
- Gallery still renders local images through `convertFileSrc`.
- Settings still loads and saves the existing directory/proxy/key flows.
- Dark and light themes both render correctly.
- Layout remains usable at 1440px, 1728px, and 1920px widths.

- [ ] **Step 4: Commit the verified branch state**

```bash
git add src package.json package-lock.json
git commit -m "feat: ship the redesigned desktop shell and page layouts"
```

---

## Phase P2 follow-up backlog (blocked by current backend contracts)

Do **not** implement these items in this frontend-only branch unless new commands/contracts are added first:

- Download pause / resume / retry / delete / open-file actions
- Search resolution / ratio / color filters and the extra sorting modes not present in `src/domain/wallhaven/models.ts`
- Gallery file size / resolution metadata, delete, open in Finder, and favorites persistence
- Settings file naming, concurrency, cache management, SQLite status, API test, and update checks
- Favorites / Collections persistence, local image tags, import/export settings

If product priority changes, write a follow-up backend spec first. Then produce a second implementation plan for those contracts.

## Self-review notes

- **Spec coverage:** P0 and P1 frontend work from the approved design doc are covered by Tasks 1-8. The only uncovered PRD items are the ones blocked by missing backend contracts, and they are listed explicitly in the P2 backlog.
- **Placeholder scan:** Before execution, run a placeholder-word scan against this plan and keep the result empty.
- **Type consistency:** Keep the names `useUiShellStore`, `SearchFilters`, `WallpaperGrid`, `WallpaperCard`, `QueueTabs`, `DownloadTaskCard`, `GalleryToolbar`, and `SettingsPanel` consistent across tasks and imports.
