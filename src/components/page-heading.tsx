import { cn } from "@/lib/utils";

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
  badgeTone?: "success" | "info" | "warning" | "error";
};

const badgeToneClasses: Record<NonNullable<PageHeadingProps["badgeTone"]>, string> = {
  success: "wh-soft-success",
  info: "wh-soft-primary",
  warning: "wh-soft-warning",
  error: "border border-destructive/45 bg-destructive/10 text-destructive",
};

const badgeDotClasses: Record<NonNullable<PageHeadingProps["badgeTone"]>, string> = {
  success: "bg-emerald-400",
  info: "bg-primary",
  warning: "bg-amber-300",
  error: "bg-destructive",
};

export function PageHeading({
  eyebrow,
  title,
  description,
  badge,
  badgeTone = "success",
}: PageHeadingProps) {
  return (
    <div className="wh-page-heading">
      <p className="sr-only">{eyebrow}</p>
      <div className="wh-page-heading-row flex flex-wrap items-start justify-between gap-4 max-[640px]:grid max-[640px]:grid-cols-1 max-[640px]:justify-items-start">
        <h2 className="wh-page-heading-title font-semibold text-foreground">
          {title}
          <span aria-hidden="true" className="wh-inline-media" />
        </h2>
        {badge ? (
          <div className={cn("wh-page-heading-badge inline-flex h-8 min-w-[176px] items-center justify-center gap-2 rounded-full px-4 text-[12px] font-semibold max-[640px]:min-w-0 max-[640px]:max-w-full max-[640px]:justify-self-start", badgeToneClasses[badgeTone])}>
            <span className={cn("h-2 w-2 rounded-full", badgeDotClasses[badgeTone])} />
            {badge}
          </div>
        ) : null}
      </div>
      <p className="max-w-3xl text-[14px] font-medium leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
