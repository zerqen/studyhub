export function AuthCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[var(--bg-elev)] p-8 shadow-card">
        <div className="mb-6">
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent text-white">S</div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {hint ? <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
