import { Button } from "@/components/ui/button";
import { useUiShellStore } from "@/features/shell/ui-shell-store";

export function ConfirmDialog() {
  const confirm = useUiShellStore((state) => state.confirm);
  const setConfirm = useUiShellStore((state) => state.setConfirm);

  if (!confirm) {
    return null;
  }

  const closeDialog = () => {
    setConfirm(null);
  };

  const handleCancel = () => {
    confirm.onCancel?.();
    closeDialog();
  };

  const handleConfirm = () => {
    confirm.onConfirm?.();
    closeDialog();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <section
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-xl"
        role="dialog"
      >
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground" id="confirm-dialog-title">
            {confirm.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{confirm.description}</p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={handleCancel} type="button" variant="outline">
            {confirm.cancelLabel ?? "Cancel"}
          </Button>
          <Button onClick={handleConfirm} type="button">
            {confirm.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </section>
    </div>
  );
}
