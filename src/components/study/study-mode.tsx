"use client";

import { useMemo, useState } from "react";
import { recordAttempt, updateQuestion } from "@/actions/questions";
import { QUESTION_STATUSES, DIFFICULTIES, labelOf } from "@/lib/constants";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { useRouter } from "next/navigation";
import { FileUploader } from "../files/uploader";

type Q = {
  id: string;
  text: string;
  answer: string | null;
  explanation: string | null;
  status: string;
  difficulty: string;
  ticket: { title: string };
  attachments: { id: string; mimeType: string; originalName: string }[];
};

export function StudyMode({ questions }: { questions: Q[] }) {
  const [mode, setMode] = useState<"list" | "cards" | "train" | "random">("list");
  const [filter, setFilter] = useState("all");
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filter === "unlearned") return q.status === "UNLEARNED" || q.status === "IN_PROGRESS";
      if (filter === "hard") return q.difficulty === "HARD";
      if (filter === "review") return q.status === "REVIEW";
      return true;
    });
  }, [questions, filter]);

  const learned = questions.filter((q) => q.status === "LEARNED").length;
  const current = filtered[mode === "random" ? Math.min(i, Math.max(0, filtered.length - 1)) : i] ?? filtered[0];

  async function mark(knew: boolean) {
    if (!current) return;
    const res = await recordAttempt(current.id, knew);
    if (!res.ok) toast.push(res.error, "err");
    else toast.push(knew ? "Отмечено как выученное" : "Отложено на повтор");
    setShow(false);
    setI((n) => (n + 1) % Math.max(1, filtered.length));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["list", "cards", "train", "random"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setI(m === "random" ? Math.floor(Math.random() * Math.max(1, filtered.length)) : 0);
              setShow(false);
            }}
            className={`rounded-xl px-3 py-1.5 text-sm ${mode === m ? "bg-accent text-white" : "bg-black/5 dark:bg-white/10"}`}
          >
            {{ list: "Список", cards: "Карточки", train: "Тренировка", random: "Случайный" }[m]}
          </button>
        ))}
        <select
          className="rounded-xl border border-black/10 bg-transparent px-2 text-sm dark:border-white/10"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setI(0);
          }}
        >
          <option value="all">Все</option>
          <option value="unlearned">Только невыученные</option>
          <option value="hard">Сложные</option>
          <option value="review">На повтор</option>
        </select>
        <div className="ml-auto text-sm text-[var(--muted)]">
          Выучено {learned} из {questions.length}
        </div>
      </div>

      {mode === "list" ? (
        <div className="space-y-2">
          {filtered.map((q) => (
            <details key={q.id} className="rounded-2xl bg-[var(--bg-elev)] p-4">
              <summary className="cursor-pointer font-medium">{q.text}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{q.answer || "Ответа пока нет"}</p>
              {q.explanation ? <p className="mt-1 text-sm text-[var(--muted)]">{q.explanation}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span>{q.ticket.title}</span>
                <span>{labelOf(QUESTION_STATUSES, q.status)}</span>
                <span>{labelOf(DIFFICULTIES, q.difficulty)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => updateQuestion(q.id, { status: "LEARNED" }).then(() => router.refresh())}>
                  Выучен
                </Button>
                <FileUploader parent={{ questionId: q.id }} compact />
              </div>
            </details>
          ))}
        </div>
      ) : current ? (
        <div className="rounded-3xl bg-[var(--bg-elev)] p-6 shadow-card">
          <div className="mb-2 text-xs text-[var(--muted)]">
            {current.ticket.title} · {labelOf(DIFFICULTIES, current.difficulty)}
          </div>
          <h2 className="text-xl font-semibold">{current.text}</h2>
          {current.attachments
            .filter((a) => a.mimeType.startsWith("image/"))
            .map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={`/api/files/${a.id}`} alt={a.originalName} className="mt-4 max-h-64 rounded-xl object-contain" />
            ))}
          {show ? (
            <div className="mt-4 space-y-2 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
              <div className="whitespace-pre-wrap">{current.answer || "Ответа пока нет"}</div>
              {current.explanation ? <div className="text-sm text-[var(--muted)]">{current.explanation}</div> : null}
            </div>
          ) : (
            <Button className="mt-6" variant="secondary" onClick={() => setShow(true)}>
              {mode === "train" ? "Показать ответ" : "Показать ответ"}
            </Button>
          )}
          {(mode === "train" || mode === "random") && show ? (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => mark(true)}>Знал</Button>
              <Button variant="danger" onClick={() => mark(false)}>
                Не знал
              </Button>
            </div>
          ) : null}
          {mode === "cards" ? (
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setI((n) => (n + filtered.length - 1) % filtered.length);
                  setShow(false);
                }}
              >
                Назад
              </Button>
              <Button
                onClick={() => {
                  setI((n) => (n + 1) % filtered.length);
                  setShow(false);
                }}
              >
                Дальше
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Нет вопросов по этому фильтру.</p>
      )}
    </div>
  );
}
