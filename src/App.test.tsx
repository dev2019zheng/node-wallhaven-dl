import { render, waitFor } from "@testing-library/react";

import App from "./App";

describe("App routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.location.hash = "";
  });

  it("boots into the search page through a hash URL for the desktop shell", async () => {
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
      expect(window.location.hash).toBe("#/search");
    });
  });
});
