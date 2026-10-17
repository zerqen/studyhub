/**
 * Расшифровка лекции. Хранится текстом в Lecture.transcript:
 *
 *   <!--file:ID|Название записи-->
 *   [00:00] Абзац…
 *   [01:12] Следующий абзац…
 *
 * Блоков может быть несколько — по одному на каждый файл записи.
 */

export type Segment = {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
};

export type TranscriptLine = { t: number; text: string };
export type TranscriptBlock = { fileId: string | null; name: string; lines: TranscriptLine[] };

// Типичные «галлюцинации» Whisper на тишине и шуме в русских записях
const HALLUCINATIONS = [
  /субтитр/i,
  /продолжение следует/i,
  /редактор субтитров/i,
  /dimatorzok/i,
  /спасибо за просмотр/i,
  /подписывайтесь на канал/i,
  /ставьте лайк/i,
  /^\s*(?:\.{2,}|…)\s*$/,
  /^\s*(?:музыка|аплодисменты)\s*$/i,
];

/** Убирает сегменты-тишину, зацикленные повторы и известные «галлюцинации» */
export function cleanSegments(segments: Segment[]) {
  return segments.filter((s) => {
    const text = s.text.trim();
    if (!text) return false;
    if (HALLUCINATIONS.some((re) => re.test(text))) return false;
    if ((s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -0.8) return false;
    if ((s.compression_ratio ?? 0) > 2.6) return false;
    return true;
  });
}

/** Склеивает сегменты в абзацы примерно по минуте, стараясь резать по концу предложения */
export function toParagraphs(segments: Segment[], minSeconds = 40, maxSeconds = 90): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  let cur: { t: number; parts: string[] } | null = null;
  for (const s of cleanSegments(segments)) {
    const text = s.text.trim();
    if (!cur) cur = { t: s.start, parts: [] };
    // Whisper иногда повторяет соседний сегмент слово в слово
    if (cur.parts[cur.parts.length - 1] !== text) cur.parts.push(text);
    const length = s.end - cur.t;
    if ((length >= minSeconds && /[.!?…]$/.test(text)) || length >= maxSeconds) {
      out.push({ t: cur.t, text: cur.parts.join(" ") });
      cur = null;
    }
  }
  if (cur && cur.parts.length) out.push({ t: cur.t, text: cur.parts.join(" ") });
  return out;
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

function parseClock(value: string) {
  const parts = value.split(":").map(Number);
  return parts.reduce((a, p) => a * 60 + p, 0);
}

const MARKER = /^<!--file:([^|>]*)\|?(.*?)-->$/;
const LINE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s?(.*)$/;

export function parseTranscript(text: string): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let cur: TranscriptBlock | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const m = MARKER.exec(line.trim());
    if (m) {
      cur = { fileId: m[1] || null, name: m[2] ?? "", lines: [] };
      blocks.push(cur);
      continue;
    }
    if (!line.trim()) continue;
    if (!cur) {
      cur = { fileId: null, name: "", lines: [] };
      blocks.push(cur);
    }
    const l = LINE.exec(line.trim());
    if (l) cur.lines.push({ t: parseClock(l[1]), text: l[2] });
    else if (cur.lines.length) cur.lines[cur.lines.length - 1].text += ` ${line.trim()}`;
    else cur.lines.push({ t: 0, text: line.trim() });
  }
  return blocks.filter((b) => b.lines.length);
}

export function formatTranscript(blocks: TranscriptBlock[]) {
  return blocks
    .map((b) => [`<!--file:${b.fileId ?? ""}|${b.name.replace(/-->|\|/g, " ")}-->`, ...b.lines.map((l) => `[${clock(l.t)}] ${l.text}`)].join("\n"))
    .join("\n\n");
}

/** Заменяет (или добавляет) расшифровку конкретного файла */
export function upsertBlock(transcript: string, block: TranscriptBlock) {
  const blocks = parseTranscript(transcript).filter((b) => !block.fileId || b.fileId !== block.fileId);
  return formatTranscript([...blocks, block]);
}

/** Чистый текст для ИИ — без меток времени и служебных строк */
export function transcriptPlainText(transcript: string) {
  return parseTranscript(transcript)
    .map((b) => b.lines.map((l) => l.text).join("\n\n"))
    .join("\n\n");
}

/** Режет длинный текст на куски по абзацам (для запросов к модели с маленьким лимитом токенов) */
export function chunkText(text: string, maxChars = 8000): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paragraphs) {
    if (p.length > maxChars) {
      if (cur) chunks.push(cur);
      cur = "";
      // Очень длинный абзац — режем по предложениям
      let piece = "";
      for (const sentence of p.split(/(?<=[.!?…])\s+/)) {
        if ((piece + " " + sentence).length > maxChars && piece) {
          chunks.push(piece.trim());
          piece = "";
        }
        piece += ` ${sentence}`;
      }
      if (piece.trim()) cur = piece.trim();
      continue;
    }
    if (cur && cur.length + p.length + 2 > maxChars) {
      chunks.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
