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
    if (res?.error) {
      setBusy(false);
      setErr(res.error === "CredentialsSignin" ? "Неверный email или пароль" : res.error);
      return;
    }
    router.replace(params.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Email">
        <Input type="email" autoComplete="email" className="h-11 rounded-[10px] text-[15px]" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Field label="Пароль">
        <Input type="password" autoComplete="current-password" className="h-11 rounded-[10px] text-[15px]" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}
      <Button type="submit" className="mt-1 h-[46px] w-full rounded-[11px] text-[15px] font-semibold" size="lg" loading={busy}>
        Войти
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Вход"
      tab="login"
      hint="С возвращением — продолжим подготовку."
      footer={
        <p>
          Нет аккаунта?{" "}
          <Link className="font-semibold text-accent hover:underline" href="/register">
            Зарегистрироваться
          </Link>
        </p>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
