import { Bell, Lock, LogOut, RefreshCw, Trash2 } from "lucide-react";
import type { DesktopState } from "../../electron/types";
import { formatBytes } from "../lib/files-view";

const MORNING_SLOTS: [number, number][] = [
  [7, 30],
  [8, 0],
  [8, 30],
  [9, 0],
];

const EVENING_SLOTS: [number, number][] = [
  [19, 0],
  [20, 0],
  [21, 0],
  [22, 0],
];

export function SettingsView({
  state,
  onSyncNow,
  onLogout,
}: {
  state: DesktopState;
  onSyncNow: () => void;
  onLogout: () => void;
}) {
  const { session, snapshot, prefs, cacheFilesCount, cacheBytes, shortcut } = state;
  const syncLabel = session.lastSyncAt > 0 ? new Date(session.lastSyncAt).toLocaleString("ru-RU") : "Ещё не синхронизировано";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="heading text-3xl">Настройки</h1>

      <div className="card space-y-2 p-5">
        <h2 className="heading text-xl">Аккаунт</h2>
        <div className="font-medium">{session.user?.name || "Пользователь"}</div>
        <div className="text-sm text-muted">{session.user?.email}</div>
        <div className="flex items-center gap-1.5 border-t border-line pt-2 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" />
          Привязано к https://studyhub-lime.vercel.app
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="heading text-xl">Оффлайн-база и кэш файлов</h2>
        <div className="text-sm text-muted">Последняя синхронизация: {syncLabel}</div>
        <div className="text-sm">
          В кэше: {snapshot.tasks.length} задач, {snapshot.questions.length} карточек, {snapshot.notes.length} заметок,{" "}
          {snapshot.lectures.length} лекций, {snapshot.attachments.length} файлов · Очередь: {snapshot.pendingOpsCount}
        </div>
        <div className="text-sm text-muted">
          Скачанные файлы на диске: {cacheFilesCount} ({formatBytes(cacheBytes)})
        </div>
        {snapshot.lastError ? <div className="text-sm text-urgent">{snapshot.lastError}</div> : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={snapshot.isSyncing}
            onClick={onSyncNow}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${snapshot.isSyncing ? "animate-spin" : ""}`} />
            {snapshot.isSyncing ? "Синхронизация…" : "Синхронизировать сейчас"}
          </button>
          {cacheFilesCount > 0 ? (
            <button
              type="button"
              onClick={() => void window.studyhub.clearFileCache()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-4 text-sm hover:border-danger/50 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
              Очистить кэш файлов ({formatBytes(cacheBytes)})
            </button>
          ) : null}
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="heading text-xl">Оформление и Windows</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["system", "Системная"],
              ["light", "Чернила"],
              ["dark", "Тёмная"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => void window.studyhub.updatePrefs({ themeMode: mode })}
              className={`rounded-full border px-3.5 py-1 text-sm ${
                prefs.themeMode === mode ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-between border-t border-line pt-3 text-sm">
          <span>Показывать пары на главной и в календаре</span>
          <input
            type="checkbox"
            checked={prefs.showLessons}
            onChange={(e) => void window.studyhub.updatePrefs({ showLessons: e.target.checked })}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between border-t border-line pt-3 text-sm">
          <span>Сворачивать в системный трей при закрытии окна</span>
          <input
            type="checkbox"
            checked={prefs.minimizeToTray}
            onChange={(e) => void window.studyhub.updatePrefs({ minimizeToTray: e.target.checked })}
          />
        </label>
        <label className="flex cursor-pointer items-center justify-between border-t border-line pt-3 text-sm">
          <span>Запускать вместе с Windows</span>
          <input
            type="checkbox"
            checked={prefs.openAtLogin}
            onChange={(e) => void window.studyhub.updatePrefs({ openAtLogin: e.target.checked })}
          />
        </label>
        <div className="border-t border-line pt-2 text-xs text-muted">
          Глобальная горячая клавиша быстрого ввода задачи: <code>{shortcut}</code> (или <code>Ctrl+Shift+Space</code>)
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="heading text-xl">Оффлайн-уведомления Windows</h2>
        <div className="flex items-center justify-between text-sm">
          <span>Утренняя сводка</span>
          <input
            type="checkbox"
            checked={prefs.notifMorningEnabled}
            onChange={(e) => void window.studyhub.updatePrefs({ notifMorningEnabled: e.target.checked })}
          />
        </div>
        {prefs.notifMorningEnabled ? (
          <div className="flex gap-2">
            {MORNING_SLOTS.map(([h, m]) => {
              const active = prefs.notifMorningHour === h && prefs.notifMorningMinute === m;
              return (
                <button
                  key={`${h}:${m}`}
                  type="button"
                  onClick={() => void window.studyhub.updatePrefs({ notifMorningHour: h, notifMorningMinute: m })}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted"
                  }`}
                >
                  {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span>Вечернее напоминание</span>
          <input
            type="checkbox"
            checked={prefs.notifEveningEnabled}
            onChange={(e) => void window.studyhub.updatePrefs({ notifEveningEnabled: e.target.checked })}
          />
        </div>
        {prefs.notifEveningEnabled ? (
          <div className="flex gap-2">
            {EVENING_SLOTS.map(([h, m]) => {
              const active = prefs.notifEveningHour === h && prefs.notifEveningMinute === m;
              return (
                <button
                  key={`${h}:${m}`}
                  type="button"
                  onClick={() => void window.studyhub.updatePrefs({ notifEveningHour: h, notifEveningMinute: m })}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted"
                  }`}
                >
                  {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void window.studyhub.sendTestNotification()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-4 text-sm hover:border-accent"
        >
          <Bell className="h-4 w-4 text-accent" /> Проверить уведомление
        </button>
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-danger/40 text-sm font-medium text-danger hover:bg-danger/10"
      >
        <LogOut className="h-4 w-4" /> Выйти из аккаунта
      </button>
    </div>
  );
}
