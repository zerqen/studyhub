export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 px-6 py-16 text-center dark:border-white/10">
      <div className="mb-3 text-4xl">✨</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint ? <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
