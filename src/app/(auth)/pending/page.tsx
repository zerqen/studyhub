import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "./sign-out";

export const dynamic = "force-dynamic";

/** Сюда попадает вошедший пользователь, чей аккаунт ещё не подтверждён (или доступ снят) */
export default async function PendingPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, approved: true } });
  if (!user) redirect("/login");
  if (user.approved) redirect("/");
  return (
    <AuthCard title="Ждём подтверждения" footer={<Link className="hover:text-fg" href="/login">Ко входу</Link>}>
      <div className="flex gap-3 text-sm">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="text-muted">
          У аккаунта <span className="font-medium text-fg">{user.email}</span> пока нет доступа к сайту. Он откроется после подтверждения.
        </p>
      </div>
      <div className="mt-5">
        <SignOutButton />
      </div>
    </AuthCard>
  );
}
