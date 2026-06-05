import { MAX_VISIBLE_TOASTS, useUiShellStore } from "./ui-shell-store";

describe("ui-shell-store", () => {
  beforeEach(() => {
    useUiShellStore.setState({ toasts: [] });
  });

  it("keeps the toast stack bounded to the newest visible items", () => {
    const enqueueToast = useUiShellStore.getState().enqueueToast;

    for (let index = 1; index <= MAX_VISIBLE_TOASTS + 2; index += 1) {
      enqueueToast({
        id: `toast-${index}`,
        title: `Toast ${index}`,
        tone: "info",
      });
    }

    expect(useUiShellStore.getState().toasts.map((toast) => toast.id)).toEqual([
      "toast-3",
      "toast-4",
      "toast-5",
      "toast-6",
    ]);
  });

  it("replaces an existing toast with the same id", () => {
    const enqueueToast = useUiShellStore.getState().enqueueToast;

    enqueueToast({
      id: "settings-save",
      title: "Saving settings",
      tone: "info",
    });
    enqueueToast({
      id: "settings-save",
      title: "Settings saved",
      tone: "success",
    });

    expect(useUiShellStore.getState().toasts).toEqual([
      {
        id: "settings-save",
        title: "Settings saved",
        tone: "success",
      },
    ]);
  });
});
