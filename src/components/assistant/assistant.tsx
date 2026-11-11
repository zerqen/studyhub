"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Check, Loader2, Mic, RotateCcw, Sparkles, Square, SquarePen, X } from "lucide-react";
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

/** Быстрые подсказки над полем ввода (когда разговор уже идёт) */
const CHIPS: [string, string, boolean][] = [
  ["Добавить ДЗ", "Задали ДЗ по ", false],
  ["Что у меня на неделе?", "Что мне сдавать на этой неделе?", true],
  ["Какие пары завтра?", "Какие пары завтра?", true],
];

const headBtn =
  "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-line bg-surface text-[#424655] transition-colors hover:bg-subtle disabled:opacity-50 dark:text-muted";

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
  const hideLauncher = open || pathname === "/" || pathname.startsWith("/exams/");

  return (
    <>
      {!hideLauncher ? (
        <button
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-12 w-12 animate-pop-in place-items-center rounded-full bg-accent text-accent-fg shadow-pop transition-transform hover:scale-105 active:scale-95 lg:hidden"
          aria-label="Ассистент"
          title="Ассистент (Ctrl+J)"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      ) : null}

      {open ? (
        <div
          className="no-print fixed inset-0 z-50 flex animate-fade-in flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[408px] sm:rounded-2xl sm:border sm:border-line sm:shadow-[0_12px_32px_rgba(29,33,48,0.12)]"
          role="dialog"
          aria-label="Ассистент"
        >
          <div className="flex items-center gap-2.5 border-b border-[#ECE8DF] py-3 pl-4 pr-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-line sm:pt-3">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-fg text-bg">
              <Sparkles className="h-[17px] w-[17px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="heading text-lg leading-tight">Ассистент</span>
              <span className="truncate text-xs text-muted">видит задачи, предметы и календарь</span>
            </span>
            {messages.length ? (
              <button type="button" onClick={() => setMessages([])} title="Новый чат" aria-label="Новый чат" disabled={busy} className={headBtn}>
                <SquarePen className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} title="Закрыть" aria-label="Закрыть" className={headBtn}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto bg-[#F8F6F1] p-4 dark:bg-bg">
            {!messages.length ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-muted">
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
                      className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-accent/50"
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
                      "animate-slide-up px-3.5 py-2.5 text-sm leading-[1.45]",
                      m.role === "user"
                        ? "max-w-[85%] whitespace-pre-wrap rounded-[14px_14px_4px_14px] bg-accent text-white"
                        : "max-w-[92%] rounded-[14px_14px_14px_4px] border border-line bg-surface",
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
              <div className="flex items-center gap-2 px-0.5 text-[13px] text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
              </div>
            ) : null}
          </div>

          <Composer
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            busy={busy}
            chips={messages.length ? CHIPS : []}
            onChip={(text, now) => {
              if (now) void send(text);
              else {
                setInput(text);
                setTimeout(() => {
                  const el = inputRef.current;
                  el?.focus();
                  el?.setSelectionRange(text.length, text.length);
                }, 0);
              }
            }}
          />
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
  const waiting = active || card.state === "applying";
  return (
    <div
      className={cn(
        "w-full animate-pop-in overflow-hidden rounded-xl border bg-surface",
        waiting ? "border-[#9DB4EE] dark:border-accent/50" : "border-line",
        card.state === "cancelled" && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-[#ECE8DF] px-3.5 py-2.5 text-[13px] dark:border-line",
          waiting ? "bg-[#F4F7FE] text-[#234AB0] dark:bg-accent/10 dark:text-accent" : "text-muted",
        )}
      >
        {card.state === "done" ? <Check className="h-4 w-4 text-success" /> : card.state === "cancelled" ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        <span className="flex-1">{waiting ? "Проверь и подтверди" : card.state === "done" ? "Готово" : "Отменено"}</span>
      </div>
      <div className="px-3.5 pb-1 pt-3 text-sm font-semibold leading-snug">{card.summary}</div>
      <ul className="max-h-72 overflow-y-auto pb-1.5">
        {shown.map((it, i) => {
          const off = card.excluded.includes(i);
          return (
            <li key={i} className={cn("flex items-start gap-2 px-3.5 py-1.5", off && "opacity-40")}>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[13px] leading-snug text-[#424655] dark:text-fg/85", off && "line-through")}>
                  <Markdown inline>{it.label}</Markdown>
                </div>
                {it.detail ? <div className="mt-0.5 text-xs text-muted">{it.detail}</div> : null}
              </div>
              {active && card.items.length > 1 && card.kind !== "subject" ? (
                <button
                  onClick={() => onToggle(i)}
                  className="mt-0.5 rounded p-0.5 text-muted hover:bg-subtle hover:text-fg"
                  aria-label={off ? "Вернуть" : "Убрать"}
                  title={off ? "Вернуть" : "Не добавлять это"}
                >
                  {off ? <RotateCcw className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {card.items.length > 8 ? (
        <button className="w-full border-t border-[#ECE8DF] px-3.5 py-2 text-left text-xs font-medium text-accent hover:bg-subtle dark:border-line" onClick={() => setAll((v) => !v)}>
          {all ? "Свернуть" : `Показать все (${card.items.length})`}
        </button>
      ) : null}
      {waiting ? (
        <div className="flex gap-2 border-t border-[#ECE8DF] px-3.5 py-2.5 dark:border-line">
          <Button size="sm" className="h-9 flex-1 rounded-[9px]" loading={card.state === "applying"} disabled={!count} onClick={onConfirm}>
            Подтвердить{card.items.length > 1 ? ` (${count})` : ""}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={card.state === "applying"}
            className="h-9 rounded-[9px] border border-line bg-surface px-3 text-[13px] transition-colors hover:bg-subtle disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      ) : null}
      {card.state === "done" && (card.result || card.progress) ? (
        <div className="flex flex-col gap-0.5 border-t border-[#ECE8DF] px-3.5 py-2 text-xs dark:border-line">
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
  chips,
  onChip,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  chips: [string, string, boolean][];
  onChip: (text: string, now: boolean) => void;
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
    <div className="flex flex-col gap-2 border-t border-[#ECE8DF] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 dark:border-line sm:pb-3">
      {chips.length ? (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {chips.map(([label, text, now]) => (
            <button
              key={label}
              type="button"
              disabled={busy}
              onClick={() => onChip(text, now)}
              className="h-[30px] shrink-0 rounded-full border border-line bg-surface px-2.5 text-xs text-[#424655] transition-colors hover:border-accent/50 disabled:opacity-50 dark:text-muted"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-1.5 rounded-xl border border-line bg-surface p-1.5 transition-colors focus-within:border-[#9DB4EE] dark:focus-within:border-accent/60">
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
            aria-label="Сообщение ассистенту"
            className="max-h-44 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-[1.4] outline-none placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-0"
          />
        )}
        {typeof window !== "undefined" && "MediaRecorder" in window ? (
          <button
            type="button"
            onClick={() => (rec ? rec.stop() : void startRecording())}
            disabled={transcribing || busy}
            className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-50", rec ? "bg-danger text-white" : "text-muted hover:bg-subtle hover:text-fg", "rounded-lg")}
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-accent text-white transition-opacity disabled:opacity-40"
            aria-label="Отправить"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
