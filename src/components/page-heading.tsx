type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
};

export function PageHeading({ eyebrow, title, description, badge }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">{eyebrow}</p>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {badge ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {badge}
        </div>
      ) : null}
    </div>
  );
}
