"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { generateQuestions } from "@/actions/ai";
import { importQuestions } from "@/actions/questions";
import { normalizeQuestions, type GeneratedQuestion } from "@/lib/ai-parse";
import { chunkText } from "@/lib/transcript";
import { DIFFICULTIES, labelOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Markdown } from "../ui/markdown";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";
import { callWithWait, useAiEnabled } from "./use-ai";

/** Вопросы из текста: конспект, расшифровка лекции или любой вставленный материал */
export function QuestionGenerator({
  subjectId,
  lectureId,
  initialText = "",
  sourceHint,
  onDone,
}: {
  subjectId: string;
  lectureId?: string;
  initialText?: string;
  sourceHint?: string;
  onDone?: () => void;
}) {
  const enabled = useAiEnabled();
  const [text, setText] = useState(initialText);
  const [perPart, setPerPart] = useState<"5" | "8" | "12">("8");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [items, setItems] = useState<GeneratedQuestion[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const parts = useMemo(() => chunkText(text), [text]);

  async function run() {
    setBusy(true);
    setItems(null);
    let found: GeneratedQuestion[] = [];
    try {
      for (let i = 0; i < parts.length; i++) {
        const label = parts.length > 1 ? `Часть ${i + 1} из ${parts.length}` : "Думаю";
        setStep(`${label}…`);
        const got = await callWithWait(
          () => generateQuestions({ subjectId, lectureId, text: parts[i], count: Number(perPart) }),
          (s) => setStep(s ? `${label} · лимит бесплатного тарифа, жду ${s} с` : `${label}…`),
        );
        // Убираем повторы между частями
        found = [...found, ...normalizeQuestions(got ?? [], found.map((q) => q.text))];
        setItems(found);
        setPicked(new Set(found.map((_, idx) => idx)));
      }
      if (!found.length) toast.push("Вопросов не получилось — попробуй текст побольше", "err");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Не получилось", "err");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  async function save() {
    if (!items) return;
    const chosen = items.filter((_, i) => picked.has(i));
    if (!chosen.length) return;
    setSaving(true);
    const r = await importQuestions({ subjectId, lectureId: lectureId ?? null, questions: chosen.map((q) => ({ text: q.text, answer: q.answer || null, kind: q.kind, difficulty: q.difficulty })) });
    setSaving(false);
    if (!r.ok) toast.push(r.error, "err");
    else {
      toast.push(`Добавлено вопросов: ${r.data?.count ?? chosen.length}`);
      onDone?.();
    }
  }

  if (!enabled) {
    return <p className="text-sm text-muted">ИИ не настроен: добавь GROQ_API_KEY в переменные окружения Vercel и перезапусти сайт.</p>;
  }

  if (items && !busy) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Найдено {items.length}, выбрано {picked.size}</span>
          <button className="ml-auto text-accent hover:underline" onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((_, i) => i)))}>
            {picked.size === items.length ? "Снять все" : "Выбрать все"}
          </button>
        </div>
        <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {items.map((q, i) => (
            <li key={i} className={cn("rounded-xl border px-3 py-2.5 transition-colors", picked.has(i) ? "border-accent/40 bg-accent/5" : "border-line")}>
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={picked.has(i)}
                  onChange={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                />
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === i ? null : i)}>
                  <span className="block text-sm font-medium leading-snug">
                    <Markdown inline>{q.text}</Markdown>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {q.kind === "PROBLEM" ? <Badge tone="accent">задача</Badge> : null}
                    <Badge>{labelOf(DIFFICULTIES, q.difficulty)}</Badge>
                    <span className="text-xs text-muted">{open === i ? "скрыть ответ" : "ответ"}</span>
                  </span>
                </button>
              </div>
              {open === i ? (
                <div className="mt-2 animate-slide-up border-t border-line pt-2 pl-6 text-sm">
                  {q.answer ? <Markdown>{q.answer}</Markdown> : <span className="text-muted">Без ответа</span>}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setItems(null)}>
            Назад
          </Button>
          <Button className="flex-1" loading={saving} disabled={!picked.size} onClick={() => void save()}>
            Добавить {picked.size}
          </Button>
        </div>
        <p className="text-xs text-muted">ИИ может ошибаться — пробегись по ответам. Править можно потом на странице вопроса.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Вставь конспект, расшифровку, кусок методички — ИИ составит вопросы с ответами"
        className="block w-full resize-y rounded-xl border border-line bg-subtle/40 p-3 text-[13.5px] leading-relaxed outline-none focus:border-accent/60"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{sourceHint ?? (text ? `${text.length.toLocaleString("ru-RU")} символов` : "")}</span>
        {parts.length > 1 ? <span>· {parts.length} части</span> : null}
        <span className="ml-auto flex items-center gap-2">
          вопросов на часть
          <Segmented value={perPart} onChange={setPerPart} options={[["5", "5"], ["8", "8"], ["12", "12"]] as const} />
        </span>
      </div>
      <Button className="w-full" disabled={busy || text.trim().length < 80} onClick={() => void run()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? step : "Сделать вопросы"}
      </Button>
      {busy && items?.length ? <p className="text-center text-xs text-muted">Уже нашлось {items.length}…</p> : null}
    </div>
  );
}
