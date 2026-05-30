import { HelpCircle, Keyboard } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function MacWindowChrome() {
  return (
    <header aria-label="top bar" className="wh-window-chrome">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-1">
          <h1 className="text-[16px] font-semibold leading-5 text-foreground">Wallhaven Desktop</h1>
          <p className="text-[10px] font-medium leading-4 text-muted-foreground">Enterprise v3.0</p>
        </div>
      </div>

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
