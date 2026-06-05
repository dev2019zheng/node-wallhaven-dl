import { create } from "zustand";

export type GalleryView = "grid" | "timeline" | "list" | "compact";
export type GalleryCollectionShortcut = "Favorites" | "4K Ultra" | "Nature" | "Anime" | "Space";
export type ShellPanel = "quick-navigation" | "help";

export type DownloadSummary = {
  activeCount: number;
  completedCount: number;
  failedCount: number;
};
export type ToastTone = "info" | "success" | "error";

export type ShellToast = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

export type ConfirmState = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export type GalleryCollectionRequest = {
  label: GalleryCollectionShortcut;
  requestId: number;
};

type UiShellState = {
  selectedSearchIds: string[];
  galleryView: GalleryView;
  galleryCollectionRequest: GalleryCollectionRequest | null;
  downloadSummary: DownloadSummary;
  toasts: ShellToast[];
  confirm: ConfirmState | null;
  activeShellPanel: ShellPanel | null;
  setSelectedSearchIds: (ids: string[]) => void;
  clearSelectedSearchIds: () => void;
  setGalleryView: (view: GalleryView) => void;
  requestGalleryCollection: (label: GalleryCollectionShortcut) => void;
  setDownloadSummary: (summary: DownloadSummary) => void;
  enqueueToast: (toast: ShellToast) => void;
  dismissToast: (id: string) => void;
  setConfirm: (confirm: ConfirmState | null) => void;
  setActiveShellPanel: (panel: ShellPanel | null) => void;
};

export const defaultDownloadSummary: DownloadSummary = {
  activeCount: 0,
  completedCount: 0,
  failedCount: 0,
};

export const useUiShellStore = create<UiShellState>((set) => ({
  selectedSearchIds: [],
  galleryView: "grid",
  galleryCollectionRequest: null,
  downloadSummary: { ...defaultDownloadSummary },
  toasts: [],
  confirm: null,
  activeShellPanel: null,
  setSelectedSearchIds: (ids) => {
    set({ selectedSearchIds: ids });
  },
  clearSelectedSearchIds: () => {
    set({ selectedSearchIds: [] });
  },
  setGalleryView: (view) => {
    set({ galleryView: view });
  },
  requestGalleryCollection: (label) => {
    set((state) => ({
      galleryCollectionRequest: {
        label,
        requestId: (state.galleryCollectionRequest?.requestId ?? 0) + 1,
      },
    }));
  },
  setDownloadSummary: (summary) => {
    set({ downloadSummary: { ...summary } });
  },
  enqueueToast: (toast) => {
    set((state) => ({
      toasts: [...state.toasts, toast],
    }));
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  setConfirm: (confirm) => {
    set({ confirm });
  },
  setActiveShellPanel: (panel) => {
    set({ activeShellPanel: panel });
  },
}));
