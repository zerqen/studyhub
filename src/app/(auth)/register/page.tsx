"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";

export default function RegisterPage() {
  const [v, setV] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

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
    await signIn("credentials", { email: v.email, password: v.password, redirect: false });
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthCard
      title="Регистрация"
      hint="Создай аккаунт и добавь первый предмет."
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
