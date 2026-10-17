"use client";

import { useMemo, useState } from "react";
import { AudioLines, Check, Loader2, Pencil, Search, Sparkles, X } from "lucide-react";
import { saveTranscript, updateTranscript } from "@/actions/ai";
import { chunkBounds, decodeMono, wavChunk } from "@/lib/audio-chunks";
import { clock, parseTranscript, type Segment } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { useToast } from "../ui/toast";
import { sleep, useAiEnabled } from "./use-ai";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

type TranscribeResponse = { ok: boolean; segments?: Segment[]; duration?: number; wait?: number; error?: string; split?: boolean };

/** Перемотать плеер записи (слушает MediaPlayer на странице лекции) */
export function seekLecture(fileId: string | null, time: number) {
  window.dispatchEvent(new CustomEvent("lecture-seek", { detail: { fileId, time } }));
}

async function postTranscribe(url: string, body: Blob | null, onWait: (s: number) => void): Promise<TranscribeResponse> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { method: "POST", body, headers: body ? { "Content-Type": body.type } : undefined });
    const j = (await res.json().catch(() => ({ ok: false, error: `Ошибка сервера (${res.status})` }))) as TranscribeResponse;
    if (j.wait) {
      for (let s = Math.min(120, j.wait + 1); s > 0; s--) {
        onWait(s);
        await sleep(1000);
      }
      onWait(0);
      continue;
    }
    return j;
  }
  return { ok: false, error: "Лимит Groq не освобождается — попробуй позже" };
}

/** Скачивает запись в браузер с прогрессом. Сначала напрямую с CDN, если не вышло — через сервер. */
async function download(fileId: string, size: number, onProgress: (pct: number) => void) {
  let res: Response | null = null;
  for (const url of [`/api/files/${fileId}`, `/api/files/${fileId}?download=1`]) {
    try {
      const r = await fetch(url);
      if (r.ok && r.body) {
        res = r;
        break;
      }
    } catch {
      // CDN без CORS — пробуем через сервер
    }
  }
  if (!res?.body) throw new Error("Не удалось скачать запись");
  const total = Number(res.headers.get("content-length")) || size;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(Math.min(99, Math.round((got / total) * 100)));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}

export function TranscriptPanel({
  lecture,
  media,
  transcript,
  onChange,
}: {
  lecture: { id: string; title: string; subject: string };
  media: FileItem[];
  transcript: string;
  onChange: (text: string) => void;
}) {
  const enabled = useAiEnabled();
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(transcript);
  const toast = useToast();
  const blocks = useMemo(() => parseTranscript(transcript), [transcript]);
  const done = new Set(blocks.map((b) => b.fileId));

  async function transcribe(file: FileItem) {
    setBusy(file.id);
    const context = `${lecture.subject}. Лекция: ${lecture.title}.`;
    const onWait = (s: number) => setStep(s ? `Бесплатный лимит Groq — продолжу через ${s} с` : "Продолжаю…");
    try {
      setStep("Отправляю запись…");
      let segments: Segment[] = [];
      const direct = await postTranscribe(`/api/ai/transcribe?attachmentId=${file.id}&prompt=${encodeURIComponent(context)}`, null, onWait);
      if (direct.ok) segments = direct.segments ?? [];
      else if (!direct.split) throw new Error(direct.error ?? "Расшифровка не удалась");
      else {
        // Длинная запись: режем в браузере на куски ~2 минуты
        if (/iphone|ipad|android/i.test(navigator.userAgent) && file.size > 120 * 1024 * 1024) {
          toast.push("Длинную запись надёжнее расшифровывать с компьютера — телефону может не хватить памяти");
        }
        const data = await download(file.id, file.size, (p) => setStep(`Скачиваю запись · ${p}%`));
        setStep("Готовлю звук…");
        await sleep(30);
        const { samples, rate } = await decodeMono(data);
        const bounds = chunkBounds(samples, rate);
        let tail = "";
        for (let i = 0; i < bounds.length; i++) {
          const [from, to] = bounds[i];
          setStep(`Расшифровываю · часть ${i + 1} из ${bounds.length}`);
          const prompt = `${context} ${tail}`.trim();
          const r = await postTranscribe(`/api/ai/transcribe?prompt=${encodeURIComponent(prompt.slice(-300))}`, wavChunk(samples, rate, from, to), (s) =>
            setStep(s ? `Часть ${i + 1} из ${bounds.length} · лимит Groq, жду ${s} с` : `Расшифровываю · часть ${i + 1} из ${bounds.length}`),
          );
          if (!r.ok) throw new Error(`Часть ${i + 1}: ${r.error ?? "ошибка"}`);
          const offset = from / rate;
          const part = (r.segments ?? []).map((s) => ({ ...s, start: s.start + offset, end: s.end + offset }));
          segments = segments.concat(part);
          tail = part.map((s) => s.text).join(" ").slice(-180);
        }
      }
      setStep("Сохраняю…");
      const saved = await saveTranscript(lecture.id, file.id, file.originalName, segments);
      if (!saved.ok) throw new Error(saved.error);
      onChange(saved.data!.transcript);
      setDraft(saved.data!.transcript);
      toast.push("Расшифровка готова");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Расшифровка не удалась", "err");
    } finally {
      setBusy(null);
      setStep("");
    }
  }

  const q = query.trim().toLowerCase();
  const totalLines = blocks.reduce((a, b) => a + b.lines.length, 0);
  const limit = expanded || q ? Infinity : 8;

  if (!media.length && !transcript) return null;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AudioLines className="h-4 w-4 text-muted" /> Расшифровка записи
        </h2>
        {transcript ? (
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(transcript); }}>
                  <X className="h-3.5 w-3.5" /> Отмена
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const r = await updateTranscript(lecture.id, draft);
                    if (!r.ok) toast.push(r.error, "err");
                    else {
                      onChange(draft);
                      setEditing(false);
                      toast.push("Расшифровка сохранена");
                    }
                  }}
                >
                  <Check className="h-3.5 w-3.5" /> Сохранить
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => { setDraft(transcript); setEditing(true); }}>
                <Pencil className="h-3.5 w-3.5" /> Править
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {enabled && media.length ? (
          <div className="flex flex-wrap gap-2">
            {media.map((m) => (
              <Button key={m.id} size="sm" variant={done.has(m.id) ? "secondary" : "primary"} loading={busy === m.id} disabled={Boolean(busy)} onClick={() => void transcribe(m)}>
                <Sparkles className="h-3.5 w-3.5" />
                {done.has(m.id) ? "Расшифровать заново" : "Расшифровать"}
                {media.length > 1 ? <span className="max-w-32 truncate font-normal opacity-80">· {m.originalName}</span> : null}
              </Button>
            ))}
          </div>
        ) : null}
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
          </p>
        ) : null}
        {!transcript && !busy ? (
          <p className="text-sm text-muted">
            {enabled
              ? "Whisper превратит запись в текст с метками времени: по нему можно искать, переходить к нужному моменту и делать вопросы. Час записи — пара минут."
              : "Чтобы расшифровывать записи, добавь ключ GROQ_API_KEY в переменные окружения."}
          </p>
        ) : null}

        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            className="block w-full resize-y rounded-xl border border-line bg-subtle/40 p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent/60"
          />
        ) : transcript ? (
          <>
            {totalLines > 8 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти в расшифровке" className="h-8 pl-8 text-[13px]" />
              </div>
            ) : null}
            {blocks.map((b, bi) => {
              const lines = q ? b.lines.filter((l) => l.text.toLowerCase().includes(q)) : b.lines;
              return (
                <div key={`${b.fileId}-${bi}`} className="space-y-2">
                  {blocks.length > 1 ? <div className="label-xs">{b.name || "Запись"}</div> : null}
                  {lines.slice(0, limit).map((l, i) => (
                    <p key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
                      <button
                        className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-accent hover:underline"
                        onClick={() => seekLecture(b.fileId, l.t)}
                        title="Перейти к этому месту записи"
                      >
                        {clock(l.t)}
                      </button>
                      <span className={cn(q && "[&_mark]:rounded [&_mark]:bg-warning/30 [&_mark]:text-fg")}>{q ? highlight(l.text, q) : l.text}</span>
                    </p>
                  ))}
                  {q && !lines.length ? <p className="text-sm text-muted">Ничего не нашлось</p> : null}
                </div>
              );
            })}
            {!q && totalLines > 8 ? (
              <button className="text-sm font-medium text-accent hover:underline" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Свернуть" : `Показать всё (${totalLines} абзацев)`}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function highlight(text: string, q: string) {
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, i)) {
    out.push(text.slice(i, at), <mark key={at}>{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
  }
  out.push(text.slice(i));
  return out;
}
