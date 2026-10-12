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
    const res = await registerAction(v);
    if (!res.ok) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    await signIn("credentials", { email: v.email, password: v.password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title="Регистрация" hint="Создай аккаунт и добавь первый предмет.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Имя" error={err}>
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
        </Field>
        <Field label="Пароль">
          <Input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required minLength={8} />
        </Field>
        <Field label="Повтор пароля">
          <Input type="password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Создаём…" : "Создать аккаунт"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        Уже есть аккаунт? <Link className="underline" href="/login">Войти</Link>
      </p>
    </AuthCard>
  );
}
