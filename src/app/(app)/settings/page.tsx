"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const toast = useToast();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await changePassword(values);
    if (!result.ok) toast.push(result.error, "err");
    else { toast.push("Пароль изменён"); setValues({ current: "", password: "", confirm: "" }); }
  }
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div><h1 className="text-2xl font-semibold">Настройки</h1><p className="text-sm text-[var(--muted)]">Безопасность аккаунта и сессия.</p></div>
      <form className="space-y-4 rounded-2xl bg-[var(--bg-elev)] p-5 shadow-card" onSubmit={save}>
        <Field label="Текущий пароль"><Input type="password" value={values.current} onChange={(e) => setValues({ ...values, current: e.target.value })} required /></Field>
        <Field label="Новый пароль"><Input type="password" minLength={8} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} required /></Field>
        <Field label="Повторите новый пароль"><Input type="password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} required /></Field>
        <Button type="submit">Изменить пароль</Button>
      </form>
      <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>Выйти из аккаунта</Button>
    </div>
  );
}
