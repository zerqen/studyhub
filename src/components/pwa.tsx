"use client";

import { useEffect } from "react";

/** Регистрирует service worker (только в production, чтобы не мешать разработке) */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        // Браузер иногда меняет push-подписку — тихо отправляем актуальную на сервер
        if (!("PushManager" in window) || Notification.permission !== "granted" || location.pathname.startsWith("/login")) return;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        const { savePushSubscription } = await import("@/actions/push");
        await savePushSubscription(sub.toJSON(), navigator.userAgent);
      })
      .catch(() => undefined);
  }, []);
  return null;
}
