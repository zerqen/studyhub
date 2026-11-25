import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Sparkles, Ticket } from "lucide-react";
import type { DesktopState, QuestionDto } from "../../electron/types";
import { MarkdownView } from "../components/MarkdownView";
import { buildExamTicket, buildWeakestDeck, isSrsDue, SRS_GRADES } from "../lib/srs";

type Mode = "srs" | "weak" | "ticket";

export function ReviewView({
  state,
  onReviewQuestion,
}: {
  state: DesktopState;
  onReviewQuestion: (questionId: string, grade: number) => void;
}) {
  const { snapshot } = state;
  const [subjectId, setSubjectId] = useState<string>("");
  const [mode, setMode] = useState<Mode>("srs");
  const [deck, setDeck] = useState<QuestionDto[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const srsDeck = useMemo(
    () => snapshot.questions.filter((q) => (!subjectId || q.subjectId === subjectId) && (q.srsReps === 0 || isSrsDue(q.srsDue))),
    [snapshot.questions, subjectId],
  );

  const activeDeck = deck ?? srsDeck;
  const current = activeDeck[index] ?? null;
  const subjectsById = useMemo(() => new Map(snapshot.subjects.map((s) => [s.id, s])), [snapshot.subjects]);

  function startMode(nextMode: Mode) {
    setMode(nextMode);
    setIndex(0);
    setRevealed(false);
    if (nextMode === "weak") setDeck(buildWeakestDeck(snapshot.questions, subjectId || null));
    else if (nextMode === "ticket") setDeck(buildExamTicket(snapshot.questions, subjectId || null));
    else setDeck(null);
  }

  function gradeCard(grade: number) {
    if (!current) return;
    onReviewQuestion(current.id, grade);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        if (e.key === "1") gradeCard(1);
        else if (e.key === "2") gradeCard(3);
        else if (e.key === "3") gradeCard(4);
        else if (e.key === "4") gradeCard(5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="heading text-3xl">Повтор (SRS)</h1>
        <select
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setMode("srs");
            setDeck(null);
            setIndex(0);
            setRevealed(false);
          }}
          className="h-9 rounded-xl border border-line bg-surface px-3 text-sm outline-none"
        >
          <option value="">Все предметы</option>
          {snapshot.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startMode("srs")}
          className={`rounded-full border px-3.5 py-1.5 text-sm ${mode === "srs" ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"}`}
        >
          Очередь ({srsDeck.length})
        </button>
        <button
          type="button"
          onClick={() => startMode("weak")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${
            mode === "weak" ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> 10 мин · слабые
        </button>
        <button
          type="button"
          onClick={() => startMode("ticket")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm ${
            mode === "ticket" ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted"
          }`}
        >
          <Ticket className="h-3.5 w-3.5" /> Билет
        </button>
      </div>

      {!current ? (
        <div className="card space-y-3 p-10 text-center">
          <div className="heading text-2xl">На сегодня карточки закончились</div>
          <p className="text-sm text-muted">Все оценки сохранены оффлайн и автоматически отправятся на сервер при синхронизации.</p>
          <button
            type="button"
            onClick={() => startMode(mode)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent-soft px-4 text-sm font-medium text-accent"
          >
            <RotateCcw className="h-4 w-4" /> Повторить режим заново
          </button>
        </div>
      ) : (
        <div className="card space-y-4 p-6">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {subjectsById.get(current.subjectId)?.emoji} {subjectsById.get(current.subjectId)?.name}
              {current.lectureTitle ? ` · ${current.lectureTitle}` : ""}
            </span>
            <span>
              Карточка {index + 1} из {activeDeck.length}
            </span>
          </div>

          <div className="text-lg font-medium">
            <MarkdownView content={current.text} />
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="h-11 w-full rounded-xl bg-accent text-sm font-medium text-accent-fg hover:opacity-95"
            >
              Показать ответ (Пробел)
            </button>
          ) : (
            <div className="space-y-4 border-t border-line pt-4">
              {current.answer ? <MarkdownView content={current.answer} /> : <p className="text-sm text-muted">Ответ не заполнен</p>}
              {current.explanation ? (
                <div className="rounded-xl bg-subtle/60 p-3 text-sm">
                  <MarkdownView content={current.explanation} />
                </div>
              ) : null}

              <div className="grid grid-cols-4 gap-2 pt-2">
                {SRS_GRADES.map((g) => (
                  <button
                    key={g.grade}
                    type="button"
                    onClick={() => gradeCard(g.grade)}
                    className={`rounded-xl border px-3 py-2.5 text-center transition-opacity hover:opacity-90 ${g.color}`}
                  >
                    <div className="text-sm font-semibold">{g.label}</div>
                    <div className="text-[11px] opacity-80">
                      {g.hint} · [{g.shortcut}]
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
