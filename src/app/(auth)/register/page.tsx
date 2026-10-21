"use client";

import Link from "next/link";
import { useState } from "react";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";
import { Clock } from "lucide-react";

export default function RegisterPage() {
  const [v, setV] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const res = await registerAction(v);
    if (!res.ok) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthCard
        title="Заявка отправлена"
        footer={
          <Link className="font-medium text-accent hover:underline" href="/login">
            Ко входу
          </Link>
        }
      >
        <div className="flex gap-3 text-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <p className="text-muted">
            Аккаунт <span className="font-medium text-fg">{v.email}</span> создан и ждёт подтверждения. Войти получится, когда доступ откроют.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Регистрация"
      hint="Доступ к сайту открывается после подтверждения."
      footer={
        <p>
          Уже есть аккаунт?{" "}
          <Link className="font-medium text-accent hover:underline" href="/login">
            Войти
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Имя">
          <Input autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required autoFocus />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Пароль">
            <Input type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required minLength={8} />
          </Field>
          <Field label="Повтор">
            <Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} required />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">Минимум 8 символов</p>
        {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Создать аккаунт
        </Button>
      </form>
    </AuthCard>
  );
}
