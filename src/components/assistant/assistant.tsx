"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Check, Loader2, Mic, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { applyProposal, assistantTurn, fillAnswers, type ChatTurn } from "@/actions/assistant";
import type { Proposal } from "@/lib/assistant-tools";
import { cn } from "@/lib/utils";
import { Markdown } from "../ui/markdown";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { sleep, useAiEnabled } from "../ai/use-ai";

type CardState = "pending" | "applying" | "done" | "cancelled";
type Card = Proposal & { state: CardState; excluded: number[]; result?: string; progress?: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; cards?: Card[] };

const SUGGESTIONS: [string, boolean][] = [
  ["Что мне сдавать на этой неделе?", true],
  ["Какие пары завтра?", true],
  ["Когда ближайший экзамен и сколько вопросов там ещё не выучено?", true],
  ["Задали ДЗ по физике: задачи 3.15–3.20 к следующей паре", false],
  ["Вот вопросы к экзамену по матанализу:\n1. \n2. \n3. ", false],
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** История для модели: текст сообщений + чем закончились карточки */
function toHistory(messages: Msg[]): ChatTurn[] {
  return messages.map((m) => {
    const outcome = (m.cards ?? [])
      .map((c) => `[${c.summary}: ${c.state === "done" ? `подтверждено — ${c.result ?? "сделано"}` : c.state === "cancelled" ? "пользователь отменил" : "ждёт подтверждения"}]`)
      .join("\n");
    return { role: m.role, content: [m.content, outcome].filter(Boolean).join("\n") };
  });
}

export function Assistant({ storageKey }: { storageKey: string }) {
  const enabled = useAiEnabled();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const key = `studyhub:assistant:${storageKey}`;

  // История живёт в этом браузере — удобно вернуться к разговору
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {
      /* без истории */
    }
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-40)));
    } catch {
      /* хранилище недоступно — не страшно */
    }
  }, [messages, key]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "j" || e.key === "о")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("assistant-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("assistant-open", onOpen);
    };
  }, [open]);

  function patchCard(msgId: string, cardId: string, patch: Partial<Card>) {
    setMessages((list) => list.map((m) => (m.id !== msgId ? m : { ...m, cards: m.cards?.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })));
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    const userMsg: Msg = { id: uid(), role: "user", content: text };
    const history = toHistory(messages);
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    setStatus("Думаю…");
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const r = await assistantTurn(history, text);
        if (!r.ok) throw new Error(r.error);
        if (r.data?.wait) {
          for (let s = Math.min(90, r.data.wait + 1); s > 0; s--) {
            setStatus(`Бесплатный лимит Groq — продолжу через ${s} с`);
            await sleep(1000);
          }
          setStatus("Думаю…");
          continue;
        }
        const cards: Card[] = (r.data?.proposals ?? []).map((p) => ({ ...p, state: "pending", excluded: [] }));
        setMessages((m) => [...m, { id: uid(), role: "assistant", content: r.data?.reply ?? "", cards }]);
        return;
      }
      throw new Error("Лимит Groq не освобождается — попробуй через пару минут");
    } catch (e) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Не получилось"}` }]);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function confirm(msg: Msg, card: Card) {
    const include = card.items.map((_, i) => i).filter((i) => !card.excluded.includes(i));
    if (!include.length) return;
    patchCard(msg.id, card.id, { state: "applying" });
    const r = await applyProposal({ kind: card.kind, data: card.data }, card.excluded.length ? include : undefined);
    if (!r.ok) {
      patchCard(msg.id, card.id, { state: "pending" });
      toast.push(r.error, "err");
      return;
    }
    const ids = r.data?.fillIds ?? [];
    patchCard(msg.id, card.id, { state: "done", result: r.data?.message, progress: ids.length ? `Дописываю ответы: 0 из ${ids.length}` : undefined });
    if (!ids.length) return;
    // Ответы к вопросам — пачками по 8, с ожиданием лимитов
    let done = 0;
    for (let i = 0; i < ids.length; i += 8) {
      const batch = ids.slice(i, i + 8);
      for (let attempt = 0; attempt < 6; attempt++) {
        const f = await fillAnswers(batch);
        if (!f.ok) {
          patchCard(msg.id, card.id, { progress: `Ответы дописаны не все: ${f.error}` });
          return;
        }
        if (f.data?.wait) {
          for (let s = Math.min(90, f.data.wait + 1); s > 0; s--) {
            patchCard(msg.id, card.id, { progress: `Дописываю ответы: ${done} из ${ids.length} · лимит, жду ${s} с` });
            await sleep(1000);
          }
          continue;
        }
        done += batch.length;
        patchCard(msg.id, card.id, { progress: `Дописываю ответы: ${Math.min(done, ids.length)} из ${ids.length}` });
        break;
      }
    }
    patchCard(msg.id, card.id, { progress: `Ответы дописаны (${ids.length}) — проверь их на странице предмета` });
  }

  if (!enabled) return null;
  const hideLauncher = open || pathname.startsWith("/exams/");

  return (
    <>
      {!hideLauncher ? (
        <button
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-12 w-12 animate-pop-in place-items-center rounded-full bg-accent text-accent-fg shadow-pop transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
          aria-label="Ассистент"
          title="Ассистент (Ctrl+J)"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      ) : null}

      {open ? (
        <div className="no-print fixed inset-0 z-50 flex flex-col bg-bg animate-fade-in sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[27rem] sm:rounded-2xl sm:border sm:border-line sm:bg-surface sm:shadow-pop" role="dialog" aria-label="Ассистент">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="flex-1 text-sm font-semibold">Ассистент</span>
            {messages.length ? (
              <Button variant="ghost" size="icon-sm" onClick={() => setMessages([])} title="Новый разговор" aria-label="Новый разговор" disabled={busy}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : null}
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Закрыть">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!messages.length ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Спроси про дедлайны и расписание или опиши, что добавить, — обычными словами. Перед любым изменением покажу карточку, и ты подтвердишь.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map(([s, now]) => (
                    <button
                      key={s}
                      onClick={() => {
                        if (now) void send(s);
                        else {
                          setInput(s);
                          setTimeout(() => {
                            const el = inputRef.current;
                            el?.focus();
                            el?.setSelectionRange(s.length, s.length);
                          }, 0);
                        }
                      }}
                      className="rounded-xl border border-line px-3 py-2 text-left text-sm transition-colors hover:bg-subtle"
                    >
                      {s.split("\n")[0]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                {m.content ? (
                  <div
                    className={cn(
                      "max-w-[92%] animate-slide-up rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed",
                      m.role === "user" ? "whitespace-pre-wrap rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md bg-subtle",
                    )}
                  >
                    {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
                  </div>
                ) : null}
                {m.cards?.map((c) => (
                  <ProposalCard
                    key={c.id}
                    card={c}
                    onToggle={(i) => patchCard(m.id, c.id, { excluded: c.excluded.includes(i) ? c.excluded.filter((x) => x !== i) : [...c.excluded, i] })}
                    onConfirm={() => void confirm(m, c)}
                    onCancel={() => patchCard(m.id, c.id, { state: "cancelled" })}
                  />
                ))}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
              </div>
            ) : null}
          </div>

          <Composer inputRef={inputRef} value={input} onChange={setInput} onSend={() => void send()} busy={busy} />
        </div>
      ) : null}
    </>
  );
}

function ProposalCard({ card, onToggle, onConfirm, onCancel }: { card: Card; onToggle: (i: number) => void; onConfirm: () => void; onCancel: () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? card.items : card.items.slice(0, 8);
  const active = card.state === "pending";
  const count = card.items.length - card.excluded.length;
  return (
    <div
      className={cn(
        "w-full animate-pop-in overflow-hidden rounded-2xl border bg-surface",
        card.state === "done" ? "border-success/40" : card.state === "cancelled" ? "border-line opacity-60" : "border-accent/40",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-sm font-medium">
        {card.state === "done" ? <Check className="h-4 w-4 text-success" /> : <Sparkles className="h-4 w-4 text-accent" />}
        <span className="flex-1">{card.summary}</span>
        {card.state === "cancelled" ? <span className="text-xs font-normal text-muted">отменено</span> : null}
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {shown.map((it, i) => {
          const off = card.excluded.includes(i);
          return (
            <li key={i} className={cn("flex items-start gap-2 px-3.5 py-2", off && "opacity-40")}>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm leading-snug", off && "line-through")}>
                  <Markdown inline>{it.label}</Markdown>
                </div>
                {it.detail ? <div className="mt-0.5 text-xs text-muted">{it.detail}</div> : null}
              </div>
              {active && card.items.length > 1 && card.kind !== "subject" ? (
                <button onClick={() => onToggle(i)} className="mt-0.5 rounded p-0.5 text-muted hover:bg-subtle hover:text-fg" aria-label={off ? "Вернуть" : "Убрать"} title={off ? "Вернуть" : "Не добавлять это"}>
                  {off ? <RotateCcw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {card.items.length > 8 ? (
        <button className="w-full border-t border-line px-3.5 py-1.5 text-left text-xs font-medium text-accent hover:bg-subtle" onClick={() => setAll((v) => !v)}>
          {all ? "Свернуть" : `Показать все (${card.items.length})`}
        </button>
      ) : null}
      {active || card.state === "applying" ? (
        <div className="flex gap-2 border-t border-line p-2.5">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={card.state === "applying"}>
            Отмена
          </Button>
          <Button size="sm" className="flex-1" loading={card.state === "applying"} disabled={!count} onClick={onConfirm}>
            <Check className="h-3.5 w-3.5" /> Подтвердить{card.items.length > 1 ? ` (${count})` : ""}
          </Button>
        </div>
      ) : null}
      {card.state === "done" && (card.result || card.progress) ? (
        <div className="space-y-0.5 border-t border-line px-3.5 py-2 text-xs">
          {card.result ? <div className="text-success">{card.result}</div> : null}
          {card.progress ? <div className="text-muted">{card.progress}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Поле ввода с голосовым вводом (Whisper) */
function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  busy,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const toast = useToast();
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value, inputRef]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => {
    if (rec && seconds >= 180) rec.stop();
  }, [rec, seconds]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const parts: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && parts.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const blob = new Blob(parts, { type: r.mimeType || type || "audio/webm" });
        if (blob.size < 2000) return;
        setTranscribing(true);
        try {
          for (let attempt = 0; attempt < 5; attempt++) {
            const res = await fetch("/api/ai/transcribe", { method: "POST", body: blob, headers: { "Content-Type": blob.type } });
            const j = (await res.json()) as { ok: boolean; segments?: { text: string }[]; wait?: number; error?: string };
            if (j.wait) {
              await sleep((j.wait + 1) * 1000);
              continue;
            }
            if (!j.ok) throw new Error(j.error ?? "Не удалось распознать");
            const text = (j.segments ?? []).map((s) => s.text.trim()).join(" ").trim();
            if (text) onChange([valueRef.current.trim(), text].filter(Boolean).join(" "));
            inputRef.current?.focus();
            return;
          }
        } catch (e) {
          toast.push(e instanceof Error ? e.message : "Не удалось распознать", "err");
        } finally {
          setTranscribing(false);
        }
      };
      setSeconds(0);
      r.start();
      setRec(r);
    } catch {
      toast.push("Нет доступа к микрофону — разреши его в настройках браузера", "err");
    }
  }

  return (
    <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface px-2 py-1.5 focus-within:border-accent/60">
        {rec ? (
          <div className="flex h-9 flex-1 items-center gap-2 px-1.5 text-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
            Говори… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder={transcribing ? "Распознаю голос…" : "Спроси или опиши, что добавить"}
            className="max-h-44 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-[14.5px] leading-snug outline-none placeholder:text-muted/70"
          />
        )}
        {typeof window !== "undefined" && "MediaRecorder" in window ? (
          <button
            type="button"
            onClick={() => (rec ? rec.stop() : void startRecording())}
            disabled={transcribing || busy}
            className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-50", rec ? "bg-danger text-white" : "text-muted hover:bg-subtle hover:text-fg")}
            aria-label={rec ? "Остановить запись" : "Сказать голосом"}
            title={rec ? "Остановить" : "Сказать голосом"}
          >
            {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : rec ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </button>
        ) : null}
        {!rec ? (
          <button
            type="button"
            onClick={onSend}
            disabled={busy || !value.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition-opacity disabled:opacity-40"
            aria-label="Отправить"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
