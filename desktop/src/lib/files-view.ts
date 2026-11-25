import type { AttachmentDto, SubjectDto } from "../../electron/types";

export type FileKind = "all" | "pdf" | "docs" | "images" | "audio" | "zip";
export type FileSort = "new" | "name" | "size";

export interface FileFolder {
  id: string;
  label: string;
  color: string | null;
  selfStudy: boolean;
  count: number;
}

const DOC_RE = /\.(docx?|xlsx?|pptx?|odt|ods|rtf|txt|csv|md)$/i;
const ZIP_RE = /\.(zip|rar|7z|tar|gz)$/i;
const AUDIO_RE = /\.(mp3|m4a|wav|ogg|aac|flac|webm|opus)$/i;

export function kindOf(name: string, mime: string): Exclude<FileKind, "all"> | "other" {
  const m = mime.toLowerCase();
  if (m === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("audio/") || AUDIO_RE.test(name)) return "audio";
  if (/zip|rar|7z|tar|gzip/.test(m) || ZIP_RE.test(name)) return "zip";
  if (DOC_RE.test(name) || m.includes("word") || m.includes("sheet") || m.includes("presentation") || m.startsWith("text/")) {
    return "docs";
  }
  return "other";
}

export function extBadge(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 && idx < name.length - 1 ? name.slice(idx + 1).toUpperCase().slice(0, 4) : "ФАЙЛ";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 Б";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function isRecentAttachment(createdAt: string, nowMs = Date.now()): boolean {
  const ms = Date.parse(createdAt);
  if (Number.isNaN(ms)) return false;
  return nowMs - ms >= 0 && nowMs - ms <= 7 * 86_400_000;
}

export function matchFile(query: string, att: AttachmentDto): boolean {
  const words = query.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${att.originalName}\n${att.whereLabel}\n${att.folderName}`.toLowerCase().replace(/ё/g, "е");
  return words.every((w) => hay.includes(w));
}

export function buildFileFolders(attachments: AttachmentDto[], subjects: SubjectDto[]): FileFolder[] {
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const map = new Map<string, FileFolder>();
  for (const att of attachments) {
    const fid = att.folder || "loose";
    if (fid === "loose") continue;
    const prev = map.get(fid);
    if (prev) {
      prev.count += 1;
    } else {
      const sub = subjectsById.get(fid);
      map.set(fid, {
        id: fid,
        label: sub?.name || att.folderName || "Предмет",
        color: sub?.color || att.folderColor || null,
        selfStudy: Boolean(att.folderSelfStudy),
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => Number(a.selfStudy) - Number(b.selfStudy) || a.label.localeCompare(b.label, "ru"));
}

export function filterAndSortFiles(
  attachments: AttachmentDto[],
  folderId: string,
  kind: FileKind,
  sort: FileSort,
  query: string,
  nowMs = Date.now(),
): AttachmentDto[] {
  const searching = query.trim().length > 0;
  let list = searching
    ? attachments.filter((a) => matchFile(query, a))
    : folderId === "all"
      ? attachments
      : folderId === "recent"
        ? attachments.filter((a) => isRecentAttachment(a.createdAt, nowMs))
        : folderId === "loose"
          ? attachments.filter((a) => a.folder === "loose")
          : attachments.filter((a) => a.folder === folderId || a.subjectId === folderId);

  if (kind !== "all") {
    list = list.filter((a) => kindOf(a.originalName, a.mimeType) === kind);
  }

  return [...list].sort((a, b) => {
    if (sort === "name") return a.originalName.localeCompare(b.originalName, "ru");
    if (sort === "size") return b.size - a.size;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
