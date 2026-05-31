import { HelpCircle, Keyboard } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function MacWindowChrome() {
  return (
    <header aria-label="top bar" className="wh-window-chrome">
      <div aria-hidden="true" />

      <div className="flex items-center gap-2">
        <button aria-label="Keyboard shortcuts" className="wh-chrome-button" type="button">
          <Keyboard className="h-4 w-4" />
        </button>
        <button aria-label="Help" className="wh-chrome-button" type="button">
          <HelpCircle className="h-4 w-4" />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
