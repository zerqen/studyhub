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
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await resetPasswordAction({ token, password, confirm });
        if (!res.ok) setErr(res.error);
        else router.push("/login");
      }}
    >
      <Field label="Новый пароль" error={err}>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
      </Field>
      <Field label="Повтор">
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full">
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
