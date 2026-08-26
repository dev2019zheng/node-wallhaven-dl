import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { useUiShellStore } from "@/features/shell/ui-shell-store";

import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    useUiShellStore.setState({
      activeGalleryCollectionShortcut: null,
      downloadSummary: {
        activeCount: 0,
        completedCount: 0,
        failedCount: 0,
      },
      galleryCollectionRequest: null,
    });
  });

  it("marks collection shortcuts as active after they navigate to Gallery", async () => {
    render(
      <MemoryRouter initialEntries={["/search"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nature", pressed: false }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nature", pressed: true })).toBeInTheDocument();
    });
    expect(useUiShellStore.getState().galleryCollectionRequest?.label).toBe("Nature");
    expect(useUiShellStore.getState().activeGalleryCollectionShortcut).toBe("Nature");
  });

  it("does not show stale collection selection outside Gallery", () => {
    useUiShellStore.setState({
      activeGalleryCollectionShortcut: "Space",
    });

    render(
      <MemoryRouter initialEntries={["/search"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Space", pressed: false })).toBeInTheDocument();
  });
});
