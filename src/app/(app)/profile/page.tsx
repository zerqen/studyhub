"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { updateProfile } from "@/actions/profile";
import { initials } from "@/lib/utils";
import { FileUploader } from "@/components/files/uploader";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const value = name ?? session?.user?.name ?? "";
  const image = session?.user?.image;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await updateProfile({ name: value });
    setBusy(false);
    if (!result.ok) toast.push(result.error, "err");
    else {
      toast.push("Профиль сохранён");
      await update({ name: value });
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Профиль" />
      <div className="card divide-y divide-line">
        <div className="flex items-center gap-4 p-5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${image}`} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-accent/10 text-lg font-semibold text-accent">{initials(value)}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{session?.user?.name}</div>
            <div className="truncate text-sm text-muted">{session?.user?.email}</div>
          </div>
          {session?.user?.id ? <FileUploader parent={{ avatar: true }} /> : null}
        </div>
        <form className="space-y-4 p-5" onSubmit={save}>
          <Field label="Имя">
            <Input value={value} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Button type="submit" loading={busy}>
            Сохранить
          </Button>
        </form>
      </div>
    </div>
  );
}
