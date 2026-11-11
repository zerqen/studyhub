/** Страница «Файлы»: в какую папку попадает файл и откуда он. Чистые функции — проверяются тестами. */

export type Subj = { id: string; name: string; color: string; selfStudy: boolean };

/** Строка из базы: файл и всё, к чему он может быть прикреплён */
export type FileRow = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string | Date;
  subject?: Subj | null;
  task?: { id: string; title: string; subject: Subj | null } | null;
  subtask?: { title: string; task: { id: string; title: string; subject: Subj | null } } | null;
  question?: { id: string; text: string; subject: Subj } | null;
  note?: { id: string; title: string; subject: Subj | null } | null;
  lecture?: { id: string; number: number | null; title: string; subject: Subj } | null;
  comment?: { task: { id: string; title: string; subject: Subj | null } | null; question: { id: string; text: string; subject: Subj } | null } | null;
  examItemId?: string | null;
};

export type FileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  /** id предмета или "loose" — загружено, никуда не прикреплено */
  folder: string;
  where: string;
  whereHref: string | null;
};

export type Folder = { id: string; name: string; color: string; selfStudy: boolean; count: number };

const cut = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Куда относится файл: предмет и подпись «откуда» со ссылкой */
export function placeFile(f: FileRow): { subject: Subj | null; where: string; whereHref: string | null } {
  if (f.lecture) return { subject: f.lecture.subject, where: `Лекция ${f.lecture.number ?? ""}`.trim() + ` · ${cut(f.lecture.title, 30)}`, whereHref: `/lectures/${f.lecture.id}` };
  if (f.task) return { subject: f.task.subject, where: `Задача «${cut(f.task.title)}»`, whereHref: `/tasks/${f.task.id}` };
  if (f.subtask) return { subject: f.subtask.task.subject, where: `Этап задачи «${cut(f.subtask.task.title)}»`, whereHref: `/tasks/${f.subtask.task.id}` };
  if (f.question) return { subject: f.question.subject, where: `Вопрос «${cut(f.question.text)}»`, whereHref: `/questions/${f.question.id}` };
  if (f.note) return { subject: f.note.subject, where: `Заметка «${cut(f.note.title)}»`, whereHref: `/notes?open=${f.note.id}` };
  if (f.comment?.task) return { subject: f.comment.task.subject, where: `Комментарий к задаче «${cut(f.comment.task.title, 30)}»`, whereHref: `/tasks/${f.comment.task.id}` };
  if (f.comment?.question) return { subject: f.comment.question.subject, where: `Комментарий к вопросу`, whereHref: `/questions/${f.comment.question.id}` };
  if (f.examItemId) return { subject: null, where: "Пробный экзамен", whereHref: null };
  if (f.subject) return { subject: f.subject, where: "Материалы предмета", whereHref: `/subjects/${f.subject.id}?tab=materials` };
  return { subject: null, where: "Не прикреплено", whereHref: null };
}

/** Файлы + папки (предметы с файлами, по алфавиту; «Изучаю» отдельно) */
export function buildFiles(rows: FileRow[]) {
  const folders = new Map<string, Folder>();
  const items: FileItem[] = rows.map((r) => {
    const { subject, where, whereHref } = placeFile(r);
    const folder = subject ? subject.id : "loose";
    if (subject) {
      const f = folders.get(subject.id) ?? { id: subject.id, name: subject.name, color: subject.color, selfStudy: subject.selfStudy, count: 0 };
      f.count++;
      folders.set(subject.id, f);
    }
    return { id: r.id, name: r.originalName, mimeType: r.mimeType, size: r.size, createdAt: new Date(r.createdAt).toISOString(), folder, where, whereHref };
  });
  const list = [...folders.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return {
    items,
    subjects: list.filter((f) => !f.selfStudy),
    learn: list.filter((f) => f.selfStudy),
    loose: items.filter((i) => i.folder === "loose").length,
  };
}

export type Kind = "all" | "pdf" | "docs" | "images" | "zip";
const EXT_DOCS = /\.(docx?|xlsx?|pptx?|odt|ods|rtf|txt|csv|md)$/i;

export function kindOf(name: string, mime: string): Exclude<Kind, "all"> | "other" {
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("image/")) return "images";
  if (/zip|rar|7z|tar|gzip/.test(mime) || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return "zip";
  if (EXT_DOCS.test(name) || mime.includes("word") || mime.includes("sheet") || mime.includes("presentation")) return "docs";
  return "other";
}

/** Поиск: все слова — в названии, подписи «откуда» или имени папки */
export function matchFile(q: string, f: FileItem, folderName: string) {
  const words = q.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${f.name}\n${f.where}\n${folderName}`.toLowerCase().replace(/ё/g, "е");
  return words.every((w) => hay.includes(w));
}

export function fileSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}
