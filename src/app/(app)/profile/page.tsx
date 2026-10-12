"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateProfile } from "@/actions/profile";
import { FileUploader } from "@/components/files/uploader";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");
  const toast = useToast();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const result = await updateProfile({ name });
    if (!result.ok) toast.push(result.error, "err");
    else { toast.push("Профиль сохранён"); await update({ name }); }
  }
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div><h1 className="text-2xl font-semibold">Профиль</h1><p className="text-sm text-[var(--muted)]">{session?.user?.email}</p></div>
      <div className="rounded-2xl bg-[var(--bg-elev)] p-5 shadow-card">
        <form className="space-y-4" onSubmit={save}>
          <Field label="Имя"><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></Field>
          <Button type="submit">Сохранить имя</Button>
        </form>
        {session?.user?.id ? <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10"><p className="mb-2 text-sm font-medium">Аватар</p><FileUploader parent={{ avatar: true }} /></div> : null}
      </div>
    </div>
  );
}
