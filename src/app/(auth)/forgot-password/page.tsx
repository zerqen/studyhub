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
    <AuthCard
      title="Восстановление пароля"
      hint="Укажи email — пришлём ссылку для сброса."
      footer={
        <Link className="hover:text-fg" href="/login">
          ← Назад ко входу
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await forgotPasswordAction({ email });
          setBusy(false);
          if (res.ok) setUrl(res.data?.resetUrl ?? "Если аккаунт существует, ссылка отправлена на почту.");
        }}
      >
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Отправить ссылку
        </Button>
      </form>
      {url ? (
        <div className="mt-4 break-all rounded-lg bg-subtle px-3 py-2.5 text-sm">
          {url.startsWith("http") ? (
            <>
              Ссылка для сброса:{" "}
              <Link className="text-accent underline" href={url}>
                {url}
              </Link>
            </>
          ) : (
            url
          )}
        </div>
      ) : null}
    </AuthCard>
  );
}
