"use client";

import Link from "next/link";
import { useState } from "react";
import { forgotPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AuthCard } from "@/components/auth/auth-card";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <AuthCard title="Восстановление пароля" hint="Для локальной разработки ссылка показывается на экране (почта опциональна).">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await forgotPasswordAction({ email });
          setBusy(false);
          if (res.ok) setUrl(res.data?.resetUrl ?? "Если аккаунт существует, ссылка создана.");
        }}
      >
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          Отправить ссылку
        </Button>
      </form>
      {url ? (
        <p className="mt-4 break-all text-sm">
          Ссылка для сброса:{" "}
          {url.startsWith("http") ? (
            <Link className="underline" href={url}>
              {url}
            </Link>
          ) : (
            url
          )}
        </p>
      ) : null}
      <p className="mt-4 text-center text-sm">
        <Link className="underline" href="/login">
          Назад ко входу
        </Link>
      </p>
    </AuthCard>
  );
}
