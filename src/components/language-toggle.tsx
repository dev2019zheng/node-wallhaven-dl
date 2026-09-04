import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { setAppLocale } from "@/i18n";
import { type AppLocale, toggleLocale } from "@/i18n/locale-preference";

export function LanguageToggle() {
  const { t, i18n } = useTranslation("common");
  const current: AppLocale = i18n.language?.startsWith("zh") ? "zh" : "en";
  const next = toggleLocale(current);
  const label = next === "zh" ? t("language.showZh") : t("language.showEn");
  const ariaLabel = next === "zh" ? t("language.switchToZh") : t("language.switchToEn");

  return (
    <Button
      aria-label={ariaLabel}
      className="h-8 rounded-full px-3 shadow-none"
      onClick={() => {
        void setAppLocale(next);
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      <Languages className="h-4 w-4" />
      <span className="theme-mode-label text-[12px] font-semibold tracking-wide">{label}</span>
    </Button>
  );
}
