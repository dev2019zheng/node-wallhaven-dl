type ErrorStateProps = {
  message: string;
  title?: string;
};

export function ErrorState({ message, title }: ErrorStateProps) {
  return (
    <div
      className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <p>{message}</p>
    </div>
  );
}
