"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await resetPasswordAction({ token, password, confirm });
        setBusy(false);
        if (!res.ok) setErr(res.error);
        else router.push("/login");
      }}
    >
      <Field label="Новый пароль" hint="Минимум 8 символов">
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
      </Field>
      <Field label="Повтори пароль">
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}
      <Button type="submit" className="w-full" size="lg" loading={busy}>
        Сохранить пароль
      </Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <AuthCard title="Новый пароль">
      <Suspense>
        <Form />
      </Suspense>
    </AuthCard>
  );
}
