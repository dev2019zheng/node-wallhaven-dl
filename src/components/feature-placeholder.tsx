type FeaturePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  bullets: string[];
  note?: string;
};

export function FeaturePlaceholder({
  eyebrow,
  title,
  description,
  status,
  bullets,
  note,
}: FeaturePlaceholderProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border/80 bg-card/60 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="wh-soft-success inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {status}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bullets.map((bullet) => (
          <article
            className="rounded-2xl border border-border/80 bg-card/40 p-5 shadow-sm shadow-black/10"
            key={bullet}
          >
            <h3 className="text-sm font-semibold text-foreground">Planned slice</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{bullet}</p>
          </article>
        ))}
      </div>

      {note ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
          {note}
        </div>
      ) : null}
    </section>
  );
}
