import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eveningDigest, morningDigest } from "@/lib/push-digest";
import { sendPush, vapidKeys } from "@/lib/webpush";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Запускается Vercel Cron (см. vercel.json): утром — сводка на день, вечером — домашка на завтра.
 * Vercel сам передаёт заголовок Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!vapidKeys()) return NextResponse.json({ ok: false, error: "VAPID keys are not set" }, { status: 500 });

  const url = new URL(req.url);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Moscow" }).format(new Date()));
  const slot = url.searchParams.get("slot") ?? (hour < 14 ? "morning" : "evening");
  if (slot !== "morning" && slot !== "evening") return NextResponse.json({ ok: false, error: "bad slot" }, { status: 400 });

  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} }, ...(slot === "morning" ? { pushMorning: true } : { pushEvening: true }) },
    select: { id: true, pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } } },
  });

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  let failed = 0;
  for (const user of users) {
    const message = slot === "morning" ? await morningDigest(user.id) : await eveningDigest(user.id);
    if (!message) {
      skipped++;
      continue;
    }
    await Promise.all(
      user.pushSubscriptions.map(async (sub) => {
        try {
          const r = await sendPush(sub, message);
          if (r.gone) {
            removed++;
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else if (r.ok) {
            sent++;
            await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } });
          } else failed++;
        } catch {
          failed++;
        }
      }),
    );
  }
  return NextResponse.json({ ok: true, slot, users: users.length, sent, skipped, removed, failed });
}
