/**
 * Минимальный разбор календаря .ics (RFC 5545) — то, что отдают расписания вузов:
 * VEVENT с UID, DTSTART/DTEND, SUMMARY, LOCATION, DESCRIPTION.
 * Работает и в браузере (предпросмотр), и на сервере (импорт).
 */

export type IcsEvent = {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  /** Тип занятия, распознанный по описанию/названию */
  kind: "LECTURE" | "SEMINAR" | "LAB" | "TEST" | "CONSULT" | "EXAM" | "OTHER";
  /** Преподаватель, если он есть в описании (строка вида «Фамилия Имя Отчество») */
  teacher: string | null;
};

function unfold(text: string) {
  // Длинные строки в .ics переносятся: следующая строка начинается с пробела или таба
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

/** Сдвиг часового пояса (в минутах) для TZID — достаточно для российских расписаний */
const TZ_OFFSETS: Record<string, number> = {
  "Europe/Moscow": 180,
  "Europe/Samara": 240,
  "Asia/Yekaterinburg": 300,
  "Europe/Kaliningrad": 120,
  UTC: 0,
};

function parseDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - 180 * 60_000), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (m[7]) return { date: new Date(utc), allDay: false };
  // Время без Z — локальное: берём TZID, а если его нет — Москву
  const tz = params.match(/TZID=([^;:]+)/i)?.[1] ?? "Europe/Moscow";
  const offset = TZ_OFFSETS[tz] ?? 180;
  return { date: new Date(utc - offset * 60_000), allDay: false };
}

const KIND_RULES: [RegExp, IcsEvent["kind"]][] = [
  [/^(лк|лекц)/i, "LECTURE"],
  [/^(пз|практ|сем)/i, "SEMINAR"],
  [/^(лр|лаб)/i, "LAB"],
  [/^(экз|зач|диф)/i, "EXAM"],
  [/^(кр|контр|тест|коллокв)/i, "TEST"],
  [/^(конс)/i, "CONSULT"],
];

function detectKind(description: string | null, title: string): IcsEvent["kind"] {
  const first = (description ?? "").split("\n")[0].trim();
  for (const [re, kind] of KIND_RULES) if (re.test(first)) return kind;
  // иногда тип пишут в названии: «Лекция: Матанализ», «Матанализ (ЛР)»
  const t = title.toLowerCase();
  if (/\(лк\)|лекция/.test(t)) return "LECTURE";
  if (/\(пз\)|практика|семинар/.test(t)) return "SEMINAR";
  if (/\(лр\)|лаборатор/.test(t)) return "LAB";
  if (/экзамен|зачёт|зачет/.test(t)) return "EXAM";
  return "OTHER";
}

function detectTeacher(description: string | null) {
  if (!description) return null;
  const line = description
    .split("\n")
    .slice(1)
    .map((s) => s.trim())
    .find((s) => /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё-]+(\s+[А-ЯЁ][а-яё-]+)?$/.test(s) || /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.$/.test(s));
  return line ?? null;
}

export function parseIcs(text: string): { name: string | null; events: IcsEvent[] } {
  const src = unfold(text);
  if (!/BEGIN:VCALENDAR/i.test(src)) throw new Error("Это не файл календаря (.ics)");
  const name = src.match(/^X-WR-CALNAME:(.*)$/m)?.[1]?.trim() ?? null;
  const events: IcsEvent[] = [];
  const blocks = src.split(/BEGIN:VEVENT/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/END:VEVENT/i)[0];
    const props = new Map<string, { params: string; value: string }>();
    for (const line of block.split("\n")) {
      const idx = line.indexOf(":");
      if (idx <= 0) continue;
      const head = line.slice(0, idx);
      const [key, ...rest] = head.split(";");
      const k = key.toUpperCase();
      if (!props.has(k)) props.set(k, { params: rest.join(";"), value: line.slice(idx + 1) });
    }
    const dtstart = props.get("DTSTART");
    if (!dtstart) continue;
    if (/^CANCELLED$/i.test(props.get("STATUS")?.value.trim() ?? "")) continue;
    const start = parseDate(dtstart.value, dtstart.params);
    if (!start) continue;
    const dtend = props.get("DTEND");
    const end = dtend ? parseDate(dtend.value, dtend.params) : null;
    const title = unescape(props.get("SUMMARY")?.value ?? "Без названия").replace(/\s+/g, " ");
    const description = props.get("DESCRIPTION") ? unescape(props.get("DESCRIPTION")!.value) : null;
    const location = props.get("LOCATION") ? unescape(props.get("LOCATION")!.value) || null : null;
    const uid = (props.get("UID")?.value.trim() || `${title}|${dtstart.value}`).slice(0, 250);
    events.push({
      uid,
      title,
      start: start.date,
      end: end && !start.allDay ? end.date : null,
      allDay: start.allDay,
      location,
      description,
      kind: detectKind(description, title),
      teacher: detectTeacher(description),
    });
  }
  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { name, events };
}

/** Сводка для предпросмотра: какие предметы и сколько пар каждого типа */
export function summarizeIcs(events: IcsEvent[]) {
  const subjects = new Map<string, { name: string; count: number; kinds: Record<string, number>; exam: Date | null }>();
  for (const e of events) {
    const s = subjects.get(e.title) ?? { name: e.title, count: 0, kinds: {}, exam: null };
    s.count++;
    s.kinds[e.kind] = (s.kinds[e.kind] ?? 0) + 1;
    if (e.kind === "EXAM" && (!s.exam || e.start < s.exam)) s.exam = e.start;
    subjects.set(e.title, s);
  }
  return {
    total: events.length,
    from: events[0]?.start ?? null,
    to: events[events.length - 1]?.start ?? null,
    subjects: [...subjects.values()].sort((a, b) => b.count - a.count),
  };
}

/** Нормализация названия для сопоставления с предметами: регистр, ё, пробелы, знаки */
export function normalizeName(s: string) {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, " ").trim();
}
