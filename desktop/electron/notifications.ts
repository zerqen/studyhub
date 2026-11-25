import { Notification } from "electron";
import type { DesktopStore } from "./store";

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildMorningDigest(store: DesktopStore): { title: string; body: string } | null {
  const data = store.getData();
  const todayKey = localDateKey();
  const nowMs = Date.now();
  const openTasks = data.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < todayKey);
  const todayTasks = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === todayKey);
  const dueCards = data.questions.filter((q) => q.srsReps > 0 && (!q.srsDue || Date.parse(q.srsDue) <= nowMs)).length;

  const lines: string[] = [];
  if (data.prefs.showLessons && data.todayEvents.length > 0) {
    const first = data.todayEvents[0];
    lines.push(`Первая пара: ${first.allDay ? "весь день" : first.start.slice(11, 16)} ${first.title}`);
  }
  if (overdue.length > 0) lines.push(`Просрочено: ${plural(overdue.length, "дело", "дела", "дел")}`);
  const hw = todayTasks.filter((t) => t.kind === "HOMEWORK").length;
  const other = todayTasks.length - hw;
  const parts: string[] = [];
  if (hw > 0) parts.push(`сдать ${plural(hw, "домашку", "домашки", "домашек")}`);
  if (other > 0) parts.push(plural(other, "задача", "задачи", "задач"));
  if (dueCards > 0) parts.push(`${plural(dueCards, "карточка", "карточки", "карточек")} к повтору`);
  if (parts.length > 0) lines.push(parts.join(" · "));

  if (lines.length === 0) return null;
  return {
    title: overdue.length > 0 ? "Дедлайны и планы на день" : todayTasks.length > 0 ? "Задачи на сегодня" : "Доброе утро · StudyHub",
    body: lines.join("\n"),
  };
}

export function buildEveningDigest(store: DesktopStore): { title: string; body: string } | null {
  const data = store.getData();
  const today = new Date();
  const tmr = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const todayKey = localDateKey(today);
  const tmrKey = localDateKey(tmr);
  const nowMs = Date.now();

  const openTasks = data.tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < todayKey).length;
  const tmrTasks = openTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === tmrKey);
  const dueCards = data.questions.filter((q) => q.srsReps > 0 && (!q.srsDue || Date.parse(q.srsDue) <= nowMs)).length;

  const lines: string[] = [];
  const hw = tmrTasks.filter((t) => t.kind === "HOMEWORK");
  for (const t of hw.slice(0, 3)) {
    lines.push(`ДЗ: ${t.title}`);
  }
  if (tmrTasks.length - hw.length > 0) {
    lines.push(`${plural(tmrTasks.length - hw.length, "задача", "задачи", "задач")} на завтра`);
  }
  if (overdue > 0) lines.push(`Висит просроченных: ${overdue}`);
  if (dueCards > 0) lines.push(`${plural(dueCards, "карточка ждёт", "карточки ждут", "карточек ждут")} повторения`);

  if (lines.length === 0) return null;
  return {
    title: hw.length > 0 ? `На завтра ${plural(hw.length, "домашка", "домашки", "домашек")}` : "Вечернее напоминание",
    body: lines.join("\n"),
  };
}

export class NotificationScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly store: DesktopStore, private readonly onClick?: () => void) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  sendTest(): void {
    const content = buildMorningDigest(this.store) ?? {
      title: "StudyHub Desktop",
      body: "Нативные уведомления Windows работают даже без интернета.",
    };
    this.show(content.title, content.body);
  }

  private show(title: string, body: string): void {
    if (!Notification.isSupported()) return;
    const notif = new Notification({ title, body });
    if (this.onClick) notif.on("click", this.onClick);
    notif.show();
  }

  private tick(): void {
    if (!this.store.getToken()) return;
    const data = this.store.getData();
    const now = new Date();
    const todayKey = localDateKey(now);
    const curMin = now.getHours() * 60 + now.getMinutes();

    if (data.prefs.notifMorningEnabled) {
      const target = data.prefs.notifMorningHour * 60 + data.prefs.notifMorningMinute;
      if (curMin >= target && data.lastDigestDates.morning !== todayKey) {
        data.lastDigestDates.morning = todayKey;
        this.store.save();
        const content = buildMorningDigest(this.store);
        if (content) this.show(content.title, content.body);
      }
    }

    if (data.prefs.notifEveningEnabled) {
      const target = data.prefs.notifEveningHour * 60 + data.prefs.notifEveningMinute;
      if (curMin >= target && data.lastDigestDates.evening !== todayKey) {
        data.lastDigestDates.evening = todayKey;
        this.store.save();
        const content = buildEveningDigest(this.store);
        if (content) this.show(content.title, content.body);
      }
    }
  }
}
