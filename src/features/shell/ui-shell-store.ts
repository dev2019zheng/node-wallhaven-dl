import { create } from "zustand";

export type GalleryView = "grid" | "compact";

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

type UiShellState = {
  globalQuery: string;
  selectedSearchIds: string[];
  galleryView: GalleryView;
  downloadSummary: DownloadSummary;
  toasts: ShellToast[];
  confirm: ConfirmState | null;
  setGlobalQuery: (value: string) => void;
  setSelectedSearchIds: (ids: string[]) => void;
  clearSelectedSearchIds: () => void;
  setGalleryView: (view: GalleryView) => void;
  setDownloadSummary: (summary: DownloadSummary) => void;
  enqueueToast: (toast: ShellToast) => void;
  dismissToast: (id: string) => void;
  setConfirm: (confirm: ConfirmState | null) => void;
};

export const defaultDownloadSummary: DownloadSummary = {
  activeCount: 0,
  completedCount: 0,
  failedCount: 0,
};

export const useUiShellStore = create<UiShellState>((set) => ({
  globalQuery: "",
  selectedSearchIds: [],
  galleryView: "grid",
  downloadSummary: { ...defaultDownloadSummary },
  toasts: [],
  confirm: null,
  setGlobalQuery: (value) => {
    set({ globalQuery: value });
  },
  setSelectedSearchIds: (ids) => {
    set({ selectedSearchIds: ids });
  },
  clearSelectedSearchIds: () => {
    set({ selectedSearchIds: [] });
  },
  setGalleryView: (view) => {
    set({ galleryView: view });
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
}));
