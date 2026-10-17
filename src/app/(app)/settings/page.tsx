"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { changePassword } from "@/actions/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader, Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { PushSettings } from "@/components/settings/push-settings";

const themes = [
  { id: "light", label: "Светлая", icon: Sun },
  { id: "dark", label: "Тёмная", icon: Moon },
  { id: "system", label: "Как в системе", icon: Monitor },
] as const;

export default function SettingsPage() {
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const toast = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await changePassword(values);
    setBusy(false);
    if (!result.ok) toast.push(result.error, "err");
    else {
      toast.push("Пароль изменён");
      setValues({ current: "", password: "", confirm: "" });
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Настройки" className="mb-0" />

      <Section title="Оформление">
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-[13px] font-medium transition-colors",
                mounted && theme === t.id ? "border-accent bg-accent/5 text-accent" : "border-line text-muted hover:text-fg",
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Уведомления на телефон">
        <PushSettings />
      </Section>

      <Section title="Пароль">
        <form className="space-y-4" onSubmit={save}>
          <Field label="Текущий пароль">
            <Input type="password" autoComplete="current-password" value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Новый пароль" hint="Минимум 8 символов">
              <Input type="password" autoComplete="new-password" minLength={8} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} required />
            </Field>
            <Field label="Повтори новый">
              <Input type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} required />
            </Field>
          </div>
          <Button type="submit" loading={busy}>
            Изменить пароль
          </Button>
        </form>
      </Section>

      <Button variant="danger-ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" /> Выйти из аккаунта
      </Button>
    </div>
  );
}
