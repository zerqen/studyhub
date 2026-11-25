import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export function LoginView({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Заполни email и пароль");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await window.studyhub.login(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="heading text-4xl text-fg">StudyHub</h1>
          <p className="mt-2 text-sm text-muted">Задачи, конспекты и подготовка к сессии — оффлайн на Windows</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6 shadow-sm">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-10 w-full rounded-xl border border-line bg-bg/50 px-3 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Пароль</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-xl border border-line bg-bg/50 pl-3 pr-10 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? <div className="rounded-xl bg-urgent-soft px-3 py-2 text-sm text-urgent">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-xl bg-accent text-sm font-medium text-accent-fg hover:opacity-95 disabled:opacity-50"
          >
            {loading ? "Входим и синхронизируем…" : "Войти"}
          </button>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted">
            <Lock className="h-3.5 w-3.5" />
            <span>studyhub-lime.vercel.app</span>
          </div>
        </form>
      </div>
    </div>
  );
}
