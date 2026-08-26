import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useUiShellStore } from "@/features/shell/ui-shell-store";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  beforeEach(() => {
    useUiShellStore.setState({
      confirm: null,
    });
  });

  it("treats escape as a cancel action", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    useUiShellStore.getState().setConfirm({
      title: "Delete wallpaper?",
      description: "This should only delete after explicit confirmation.",
      confirmLabel: "Delete",
      onCancel,
      onConfirm,
    });

    render(<ConfirmDialog />);

    expect(screen.getByRole("dialog", { name: "Delete wallpaper?" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Delete wallpaper?" })).not.toBeInTheDocument();
  });

  it("treats backdrop clicks as cancel actions", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    useUiShellStore.getState().setConfirm({
      title: "Delete download task?",
      description: "The backdrop should close without confirming.",
      confirmLabel: "Delete task",
      onCancel,
      onConfirm,
    });

    render(<ConfirmDialog />);

    fireEvent.mouseDown(screen.getByTestId("confirm-dialog-backdrop"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Delete download task?" })).not.toBeInTheDocument();
  });
});
