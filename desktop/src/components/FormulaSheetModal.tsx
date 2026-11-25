import { useMemo } from "react";
import { Sigma, X } from "lucide-react";
import type { LectureDto, QuestionDto, SubjectDto } from "../../electron/types";
import { buildFormulaSheet } from "../lib/formulas";
import { MarkdownView } from "./MarkdownView";

export function FormulaSheetModal({
  subject,
  lectures,
  questions,
  onClose,
}: {
  subject: SubjectDto;
  lectures: LectureDto[];
  questions: QuestionDto[];
  onClose: () => void;
}) {
  const groups = useMemo(() => buildFormulaSheet(lectures, questions), [lectures, questions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-accent" />
            <div>
              <h2 className="heading text-xl">Лист формул</h2>
              <p className="text-xs text-muted">
                {subject.emoji} {subject.name} · работает оффлайн
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Формул пока нет. Они собираются автоматически из LaTeX ($…$ и $$…$$) в ответах на вопросы и конспектах лекций.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-line bg-bg/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-accent">{group.title}</h3>
                <div className="space-y-3">
                  {group.entries.map((entry, idx) => (
                    <div key={idx} className="rounded-xl border border-line bg-surface p-3">
                      <div className="mb-1.5 text-sm font-medium">{entry.title}</div>
                      <MarkdownView content={entry.formulas.map((f) => `$$\n${f}\n$$`).join("\n\n")} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
