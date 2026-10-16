export function AuthCard({ title, hint, children, footer }: { title: string; hint?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-base font-bold text-accent-fg">S</span>
          <span className="text-lg font-semibold tracking-tight">StudyHub</span>
        </div>
        <div className="card p-6 shadow-card sm:p-7">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
          </div>
          {children}
        </div>
        {footer ? <div className="mt-5 space-y-1.5 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
