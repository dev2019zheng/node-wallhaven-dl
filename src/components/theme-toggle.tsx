import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-10 w-[6.5rem] rounded-full border border-border/80 bg-card/50" />
    );
  }

  const isDarkTheme = resolvedTheme !== "light";

  return (
    <Button
      aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-full"
      onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
      size="sm"
      type="button"
      variant="outline"
    >
      {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDarkTheme ? "Light" : "Dark"}</span>
    </Button>
  );
}
