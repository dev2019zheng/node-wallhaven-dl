type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
};

export function PageHeading({ eyebrow, title, description, badge }: PageHeadingProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700 dark:text-sky-300">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {badge ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/12 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 lg:ml-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {badge}
        </div>
      ) : null}
    </div>
  );
}
