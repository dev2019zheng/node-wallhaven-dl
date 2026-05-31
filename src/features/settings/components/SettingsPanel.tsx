import type { ReactNode } from "react";

type SettingsPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function SettingsPanel({ title, description, children }: SettingsPanelProps) {
  const panelId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const headingId = `${panelId}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-3xl border border-border/80 bg-background/60 p-5 shadow-sm"
      role="region"
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground" id={headingId}>
          {title}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
