type LoadingSkeletonProps = {
  label: string;
};

export function LoadingSkeleton({ label }: LoadingSkeletonProps) {
  return (
    <div
      aria-busy="true"
      className="rounded-2xl border border-border/80 bg-background/70 px-4 py-6 text-sm text-muted-foreground"
      role="status"
    >
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
        <span>{label}</span>
      </div>
    </div>
  );
}
