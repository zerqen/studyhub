"use server";

import { prisma } from "@/lib/prisma";
import { pushSubscriptionSchema } from "@/lib/validations";
import { withUser, type ActionResult } from "@/lib/action";
import { sendPush, vapidKeys } from "@/lib/webpush";
import { testDigest } from "@/lib/push-digest";

export type PushStatus = { publicKey: string | null; morning: boolean; evening: boolean; devices: number };

export async function getPushStatus(): Promise<ActionResult<PushStatus>> {
  return withUser(async (userId) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushMorning: true, pushEvening: true, _count: { select: { pushSubscriptions: true } } },
    });
    return {
      publicKey: vapidKeys()?.publicKey ?? null,
      morning: user?.pushMorning ?? true,
      evening: user?.pushEvening ?? true,
      devices: user?._count.pushSubscriptions ?? 0,
    };
  });
}

export async function savePushSubscription(input: unknown, userAgent?: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    const parsed = pushSubscriptionSchema.safeParse(input);
    if (!parsed.success) throw new Error("Браузер вернул некорректную подписку");
    const { endpoint, keys } = parsed.data;
    // Тот же браузер мог быть подписан под другим аккаунтом — подписка переходит к текущему
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    });
  });
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  return withUser(async (userId) => {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  });
}

export async function setPushPrefs(prefs: { morning?: boolean; evening?: boolean }): Promise<ActionResult> {
  return withUser(async (userId) => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof prefs.morning === "boolean" ? { pushMorning: prefs.morning } : {}),
        ...(typeof prefs.evening === "boolean" ? { pushEvening: prefs.evening } : {}),
      },
    });
  });
}

/** Отправить проверочное уведомление на все устройства пользователя */
export async function sendTestPush(): Promise<ActionResult<{ sent: number }>> {
  return withUser(async (userId) => {
    if (!vapidKeys()) throw new Error("Push не настроен на сервере: добавь VAPID-ключи в переменные окружения");
    const subs = await prisma.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
    if (!subs.length) throw new Error("Нет подписанных устройств");
    const message = await testDigest(userId);
    let sent = 0;
    for (const sub of subs) {
      const r = await sendPush(sub, message).catch(() => ({ ok: false, gone: false, status: 0 }));
      if (r.gone) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      if (r.ok) sent++;
    }
    if (!sent) throw new Error("Не удалось доставить: попробуй выключить и снова включить уведомления");
    return { sent };
  });
}
