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
      <div className="mt-1 flex flex-col gap-2 rounded-[10px] border border-[#F3D9B8] bg-[#FBF3E8] px-3.5 py-3 dark:border-urgent/30 dark:bg-urgent/10">
        <span className="text-sm font-semibold text-urgent">Уведомления на телефон пока не работают</span>
        <span className="text-[13px] text-[#424655] dark:text-muted">Колокольчик в приложении работает, а push на телефон ещё не включён на сервере.</span>
        <details>
          <summary className="flex min-h-6 cursor-pointer items-center text-xs text-muted">Для разработчика</summary>
          <span className="text-xs text-[#424655] dark:text-muted">
            Добавить ключи <code className="rounded border border-[#ECE8DF] bg-surface px-1 font-mono">VAPID_PUBLIC_KEY</code> и{" "}
            <code className="rounded border border-[#ECE8DF] bg-surface px-1 font-mono">VAPID_PRIVATE_KEY</code> в переменные окружения Vercel.
          </span>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex min-h-[64px] flex-wrap items-center gap-3 border-t border-[#ECE8DF] py-3 dark:border-line">
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
        <div>
          <Toggle
            on={status.morning}
            onChange={(v) => void togglePref("morning", v)}
            title="Утренняя сводка · около 8:00"
            hint="Сколько пар и где первая, что повторить, задачи и домашка на сегодня, скорые экзамены"
          />
          <Toggle
            on={status.evening}
            onChange={(v) => void togglePref("evening", v)}
            title="Вечернее напоминание · около 20:00"
            hint="Домашка и задачи на завтра; если сегодня не повторял — сколько вопросов ждёт. Пустые дни — без уведомлений"
          />
        </div>
      ) : null}

      {subscribed ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-start"
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

/** Переключатель в строке настроек */
function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <div className="flex min-h-[58px] items-center justify-between gap-3 border-t border-[#ECE8DF] py-2.5 dark:border-line">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
        className={`flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px] transition-colors ${on ? "justify-end bg-accent" : "justify-start bg-[#CFC9B8] dark:bg-line"}`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
      </button>
    </div>
  );
}
