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
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2">
      <p className="sr-only">{eyebrow}</p>
      <h2 className="text-[28px] font-semibold leading-[34px] tracking-normal text-foreground">{title}</h2>
      <p className="text-[14px] font-medium text-muted-foreground">{description}</p>
      {badge ? (
        <div className={cn("inline-flex h-8 min-w-[176px] items-center justify-center gap-2 rounded-full px-4 text-[12px] font-semibold sm:ml-auto", badgeToneClasses[badgeTone])}>
          <span className={cn("h-2 w-2 rounded-full", badgeDotClasses[badgeTone])} />
          {badge}
        </div>
      ) : null}
    </div>
  );
}
