"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Send, Smartphone } from "lucide-react";
import { getPushStatus, removePushSubscription, savePushSubscription, sendTestPush, setPushPrefs, type PushStatus } from "@/actions/push";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

type Support = "checking" | "ok" | "unsupported" | "ios-browser";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detectSupport(): Support {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // На iPhone push работает только у приложения, добавленного на экран «Домой»
  if (ios && !standalone) return "ios-browser";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // В разработке service worker не ставим: он кэширует файлы сборки и мешает горячей перезагрузке
  if (process.env.NODE_ENV !== "production") throw new Error("В режиме разработки уведомления не работают — проверь на опубликованном сайте");
  return navigator.serviceWorker.register("/sw.js");
}

export function PushSettings() {
  const [support, setSupport] = useState<Support>("checking");
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const r = await getPushStatus();
    if (r.ok && r.data) setStatus(r.data);
  }, []);

  useEffect(() => {
    const s = detectSupport();
    setSupport(s);
    void refresh();
    if (s !== "ok") return;
    setPermission(Notification.permission);
    void registration()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined);
  }, [refresh]);

  async function enable() {
    if (!status?.publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.push("Уведомления запрещены в браузере — разреши их в настройках сайта", "err");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(status.publicKey) });
      const r = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!r.ok) throw new Error(r.error);
      setSubscribed(true);
      toast.push("Уведомления включены на этом устройстве");
      void refresh();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Не получилось включить уведомления", "err");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.push("Уведомления на этом устройстве выключены");
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePref(key: "morning" | "evening", value: boolean) {
    setStatus((s) => (s ? { ...s, [key]: value } : s));
    const r = await setPushPrefs({ [key]: value });
    if (!r.ok) toast.push(r.error, "err");
  }

  if (support === "checking") return <p className="text-sm text-muted">Проверяю…</p>;

  if (support === "ios-browser") {
    return (
      <div className="flex gap-3 text-sm">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="space-y-1.5">
          <p className="font-medium">На iPhone уведомления работают только из приложения на экране «Домой»</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-muted">
            <li>Открой сайт в Safari и нажми «Поделиться» (квадрат со стрелкой).</li>
            <li>Выбери «На экран „Домой“» → «Добавить».</li>
            <li>Открой StudyHub с иконки и вернись сюда — появится кнопка «Включить».</li>
          </ol>
          <p className="text-xs text-muted">Нужна iOS 16.4 или новее.</p>
        </div>
      </div>
    );
  }

  if (support === "unsupported") return <p className="text-sm text-muted">Этот браузер не поддерживает push-уведомления. Попробуй Chrome, Edge, Firefox или Safari.</p>;

  if (status && !status.publicKey) {
    return (
      <p className="text-sm text-muted">
        Push пока не настроен на сервере: нужно добавить ключи <code className="rounded bg-subtle px-1">VAPID_PUBLIC_KEY</code> и{" "}
        <code className="rounded bg-subtle px-1">VAPID_PRIVATE_KEY</code> в переменные окружения Vercel.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${subscribed ? "bg-success/10 text-success" : "bg-subtle text-muted"}`}>
          {subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{subscribed ? "Включены на этом устройстве" : "Выключены на этом устройстве"}</div>
          <div className="text-xs text-muted">
            {permission === "denied"
              ? "Браузер запретил уведомления — разреши их в настройках сайта"
              : status?.devices
                ? `Подписано устройств: ${status.devices}`
                : "Можно включить на телефоне и на компьютере"}
          </div>
        </div>
        {subscribed ? (
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void disable()}>
            Выключить
          </Button>
        ) : (
          <Button size="sm" loading={busy} disabled={permission === "denied" || !status} onClick={() => void enable()}>
            <Bell className="h-3.5 w-3.5" /> Включить
          </Button>
        )}
      </div>

      {status ? (
        <div className="space-y-2 border-t border-line pt-3 text-sm">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" className="mt-0.5" checked={status.morning} onChange={(e) => void togglePref("morning", e.target.checked)} />
            <span>
              <span className="block font-medium">Утренняя сводка · около 8:00</span>
              <span className="block text-xs text-muted">Сколько пар и где первая, что повторить, задачи и домашка на сегодня, скорые экзамены</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" className="mt-0.5" checked={status.evening} onChange={(e) => void togglePref("evening", e.target.checked)} />
            <span>
              <span className="block font-medium">Вечернее напоминание · около 20:00</span>
              <span className="block text-xs text-muted">Домашка и задачи на завтра; если сегодня не повторял — сколько вопросов ждёт. Пустые дни — без уведомлений</span>
            </span>
          </label>
        </div>
      ) : null}

      {subscribed ? (
        <Button
          variant="ghost"
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await sendTestPush();
            setBusy(false);
            if (!r.ok) toast.push(r.error, "err");
            else toast.push("Отправлено — уведомление придёт через пару секунд");
          }}
        >
          <Send className="h-3.5 w-3.5" /> Прислать проверочное
        </Button>
      ) : null}
    </div>
  );
}
