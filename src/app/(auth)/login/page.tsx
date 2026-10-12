"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(undefined);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) {
      setErr("Неверный email или пароль");
      return;
    }
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Email" error={err}>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Пароль">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Входим…" : "Войти"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard title="Вход в StudyHub" hint="Готовься к сессии спокойно и по полочкам.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        Нет аккаунта? <Link className="underline" href="/register">Регистрация</Link>
        <br />
        <Link className="underline" href="/forgot-password">Забыли пароль?</Link>
      </p>
    </AuthCard>
  );
}
