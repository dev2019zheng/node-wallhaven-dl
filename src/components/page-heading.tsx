type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
};

export function PageHeading({ eyebrow, title, description, badge }: PageHeadingProps) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2">
      <p className="sr-only">{eyebrow}</p>
      <h2 className="text-[28px] font-semibold leading-[34px] tracking-normal text-foreground">{title}</h2>
      <p className="text-[14px] font-medium text-muted-foreground">{description}</p>
      {badge ? (
        <div className="wh-soft-success inline-flex h-8 min-w-[176px] items-center justify-center gap-2 rounded-full px-4 text-[12px] font-semibold sm:ml-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {badge}
        </div>
      ) : null}
    </div>
  );
}
