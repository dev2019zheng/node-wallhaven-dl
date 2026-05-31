import { useUiShellStore } from "@/features/shell/ui-shell-store";

const toastToneClassName = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "wh-soft-primary",
  success: "wh-soft-success",
} as const;

export function ToastProvider() {
  const toasts = useUiShellStore((state) => state.toasts);
  const dismissToast = useUiShellStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${toastToneClassName[toast.tone]}`}
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold">{toast.title}</p>
              {toast.description ? <p className="leading-6 opacity-90">{toast.description}</p> : null}
            </div>
            <button
              aria-label={`Dismiss ${toast.title}`}
              className="rounded-full px-2 text-base leading-none opacity-70 transition hover:opacity-100"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
