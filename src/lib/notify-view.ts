/** Лента уведомлений: группы «Сегодня / Просрочено / Раньше», повторы по одной задаче сливаются. */
import { dayKey } from "./utils";

export type Note = { id: string; title: string; body: string; href: string | null; read: boolean; kind?: string; createdAt: Date | string };

export type FeedItem = {
  /** Все уведомления, слитые в этот пункт: отметка «прочитано» ставится на все */
  ids: string[];
  kind: string;
  label: string;
  title: string;
  href: string | null;
  read: boolean;
  late: boolean;
  createdAt: Date;
};

export type FeedGroup = { id: "today" | "late" | "earlier"; title: string; items: FeedItem[] };

const late = (n: Note) => n.kind === "danger" || n.title.startsWith("Просроч");

function plural(n: number) {
  const a = n % 100;
  const b = n % 10;
  if (a >= 11 && a <= 14) return "напоминаний";
  return b === 1 ? "напоминание" : b >= 2 && b <= 4 ? "напоминания" : "напоминаний";
}

export function buildFeed(notes: Note[], now: Date, onlyUnread = false): FeedGroup[] {
  const today = dayKey(now);
  const byKey = new Map<string, FeedItem>();
  // Свежие сверху; одинаковые «Просроченная задача» по одной ссылке — одним пунктом
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const n of sorted) {
    const isLate = late(n);
    const key = isLate && n.href ? `late|${n.href}` : n.id;
    const prev = byKey.get(key);
    if (prev) {
      prev.ids.push(n.id);
      prev.read = prev.read && n.read;
      continue;
    }
    byKey.set(key, {
      ids: [n.id],
      kind: n.kind ?? "info",
      label: n.title,
      title: n.body,
      href: n.href,
      read: n.read,
      late: isLate,
      createdAt: new Date(n.createdAt),
    });
  }
  const items = [...byKey.values()].map((it) => (it.late && it.ids.length > 1 ? { ...it, label: `Просрочено · ${it.ids.length} ${plural(it.ids.length)}` } : it.late ? { ...it, label: "Просрочено" } : it));
  const shown = onlyUnread ? items.filter((i) => !i.read) : items;
  const groups: FeedGroup[] = [
    { id: "today", title: "Сегодня", items: shown.filter((i) => !i.late && dayKey(i.createdAt) === today) },
    { id: "late", title: "Просрочено", items: shown.filter((i) => i.late) },
    { id: "earlier", title: "Раньше", items: shown.filter((i) => !i.late && dayKey(i.createdAt) !== today) },
  ];
  return groups.filter((g) => g.items.length);
}
