import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Карточка входа и регистрации. tabs — вкладки «Вход / Регистрация» сверху (ссылки на соседнюю страницу),
 * на экранах «Заявка отправлена» и «Ждём подтверждения» их нет.
 */
export function AuthCard({
  title,
  hint,
  children,
  footer,
  tab,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tab?: "login" | "register";
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-[22px] px-4 pb-10 pt-12 sm:pt-16">
      <span className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-accent text-[17px] font-bold text-accent-fg">S</span>
        <span className="heading text-[22px]">StudyHub</span>
      </span>
      <section aria-label={title} className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_6px_20px_rgba(29,33,48,0.06)]">
        {tab ? (
          <nav aria-label="Вход или регистрация" className="grid grid-cols-2 border-b border-[#ECE8DF] dark:border-line">
            {(
              [
                ["login", "Вход", "/login"],
                ["register", "Регистрация", "/register"],
              ] as const
            ).map(([id, label, href]) => (
              <Link
                key={id}
                href={href}
                aria-current={tab === id ? "page" : undefined}
                className={cn("flex h-12 items-center justify-center border-b-2 text-sm font-semibold transition-colors", tab === id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-col gap-3.5 px-6 pb-6 pt-[22px]">
          <div className="space-y-1">
            <h1 className="heading text-2xl">{title}</h1>
            {hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
          </div>
          {children}
        </div>
      </section>
      {footer ? <div className="space-y-1.5 text-center text-[13px] text-muted">{footer}</div> : null}
    </div>
  );
}
