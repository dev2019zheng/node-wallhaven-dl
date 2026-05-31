import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { ConfirmDialog } from "./components/confirm-dialog";
import { ThemeAccentProvider } from "./components/theme-accent-provider";
import { ThemeProvider } from "./components/theme-provider";
import { ToastProvider } from "./components/toast-provider";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <ThemeAccentProvider>
        <App />
        <ToastProvider />
        <ConfirmDialog />
      </ThemeAccentProvider>
    </ThemeProvider>
  </StrictMode>,
);
