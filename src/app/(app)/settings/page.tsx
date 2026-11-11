"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut } from "lucide-react";
import { changePassword, updateProfile } from "@/actions/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FileUploader } from "@/components/files/uploader";
import { PushSettings } from "@/components/settings/push-settings";

/** Превью темы: фон + поверхность */
const themes = [
  { id: "light", label: "Светлая", a: "#F3F1EC", b: "#FFFEFB" },
  { id: "dark", label: "Тёмная", a: "#16161D", b: "#1F2029" },
  { id: "system", label: "Как в системе", a: "#F3F1EC", b: "#16161D" },
] as const;

const sections = [
  ["profile", "Профиль"],
  ["look", "Оформление"],
  ["notify", "Уведомления"],
  ["security", "Безопасность"],
] as const;

const card = "scroll-mt-20 overflow-hidden rounded-[14px] border border-line bg-surface";
const label = "flex flex-col gap-1.5 text-[13px] text-[#424655] dark:text-muted";
const input =
  "h-[42px] rounded-[10px] border border-line bg-surface px-3 text-[15px] text-fg outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<string>("profile");
  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: "", password: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const toast = useToast();

  useEffect(() => setMounted(true), []);

  // Подсветка раздела в боковом меню при прокрутке
  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const user = session?.user;
  const nameValue = name ?? user?.name ?? "";
  const letter = (nameValue.trim()[0] ?? "?").toUpperCase();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const r = await updateProfile({ name: nameValue });
    setSavingName(false);
    if (!r.ok) toast.push(r.error, "err");
    else {
      toast.push("Профиль сохранён");
      await update({ name: nameValue });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    const r = await changePassword(pw);
    setSavingPw(false);
    if (!r.ok) toast.push(r.error, "err");
    else {
      toast.push("Пароль изменён");
      setPw({ current: "", password: "", confirm: "" });
    }
  }

  return (
    <div className="mx-auto flex max-w-[980px] flex-wrap items-start gap-6">
      <div className="flex basis-full flex-col gap-1.5">
        <h1 className="heading text-[28px] sm:text-[34px]">Настройки</h1>
        <p className="text-sm text-muted">Профиль, внешний вид и всё остальное — на одной странице</p>
      </div>

      <nav aria-label="Разделы" className="sticky top-20 hidden w-[200px] shrink-0 flex-col gap-0.5 md:flex">
        {sections.map(([id, title]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={active === id ? "true" : undefined}
            className={cn(
              "flex h-[38px] items-center rounded-lg px-3 text-sm transition-colors",
              active === id ? "bg-accent-soft font-semibold text-[#234AB0] dark:text-accent" : "text-fg hover:bg-subtle",
            )}
          >
            {title}
          </a>
        ))}
      </nav>

      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-[18px]">
        {/* Профиль */}
        <section id="profile" aria-label="Профиль" className={card}>
          <div className="flex flex-wrap items-center gap-4 border-b border-[#ECE8DF] px-5 py-5 dark:border-line sm:px-[22px]">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${user.image}`} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="heading grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent-soft text-[26px] text-[#234AB0] dark:text-accent">
                {letter}
              </span>
            )}
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <span className="heading truncate text-[22px]">{user?.name ?? "…"}</span>
              <span className="truncate text-sm text-muted">{user?.email}</span>
            </span>
            {user?.id ? <FileUploader parent={{ avatar: true }} compact /> : null}
          </div>
          <form onSubmit={saveName} className="flex flex-wrap items-end gap-3 px-5 py-[18px] sm:px-[22px]">
            <label className={cn(label, "flex-[1_1_260px]")}>
              Имя
              <input value={nameValue} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" className={input} />
            </label>
            <Button type="submit" loading={savingName} className="h-[42px] rounded-[10px] px-[18px]">
              Сохранить
            </Button>
          </form>
        </section>

        {/* Оформление */}
        <section id="look" aria-label="Оформление" className={cn(card, "flex flex-col gap-4 px-5 py-[18px] sm:px-[22px]")}>
          <h2 className="heading text-xl">Оформление</h2>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-[#424655] dark:text-muted">Тема</span>
            <div role="group" aria-label="Тема" className="grid grid-cols-3 gap-2">
              {themes.map((t) => {
                const on = mounted && theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl px-2 py-3.5 text-[13px] font-semibold transition-colors",
                      on ? "border-2 border-accent bg-[#F4F7FE] text-[#234AB0] dark:bg-accent/10 dark:text-accent" : "border border-line bg-surface hover:border-fg/30",
                    )}
                  >
                    <span aria-hidden className="flex h-10 w-16 overflow-hidden rounded-lg border border-line">
                      <span className="flex-1" style={{ background: t.a }} />
                      <span className="flex-1" style={{ background: t.b }} />
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Уведомления */}
        <section id="notify" aria-label="Уведомления" className={cn(card, "px-5 pb-4 pt-1.5 sm:px-[22px]")}>
          <h2 className="heading mb-1.5 mt-3 text-xl">Уведомления</h2>
          <PushSettings />
        </section>

        {/* Пароль */}
        <section id="security" aria-label="Безопасность" className={card}>
          <form onSubmit={savePassword} className="flex flex-col gap-3.5 px-5 py-[18px] sm:px-[22px]">
            <h2 className="heading text-xl">Пароль</h2>
            <label className={label}>
              Текущий пароль
              <input type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={input} />
            </label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">
              <label className={label}>
                Новый пароль
                <input type="password" autoComplete="new-password" required minLength={8} value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} className={input} />
              </label>
              <label className={label}>
                Повтори новый
                <input type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={input} />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-xs text-muted">Минимум 8 символов</span>
              <Button type="submit" loading={savingPw} className="h-10 rounded-[10px] px-4">
                Изменить пароль
              </Button>
            </div>
          </form>
        </section>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex h-10 items-center gap-2 self-start rounded-[10px] border border-[#F3C7A6] bg-surface px-3.5 text-sm font-semibold text-urgent transition-colors hover:bg-urgent-soft dark:border-urgent/40"
        >
          <LogOut className="h-4 w-4" /> Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
