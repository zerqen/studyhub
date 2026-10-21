"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Eye, Headphones, Image as ImageIcon, Loader2, Maximize2, MonitorPlay, Pencil, Play, Plus, ScanText, Sparkles, Trash2, X } from "lucide-react";
import { deleteLecture, saveLectureSummary } from "@/actions/lectures";
import { recognizePhoto } from "@/actions/ai";
import { transcriptPlainText } from "@/lib/transcript";
import { QUESTION_STATUSES, labelOf, questionStatusTone } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog, Modal } from "../ui/modal";
import { Markdown } from "../ui/markdown";
import { useToast } from "../ui/toast";
import { FileUploader } from "../files/uploader";
import { FileGrid } from "../files/file-grid";
import { QuestionForm } from "../questions/question-form";
import { StudyMode, type StudyQuestion } from "../study/study-mode";
import { LectureForm } from "./lecture-form";
import { TranscriptPanel } from "../ai/transcript-panel";
import { QuestionGenerator } from "../ai/question-generator";
import { callWithWait, useAiEnabled } from "../ai/use-ai";
import { InteractiveFrame } from "../interactive/interactive-frame";
import { InteractiveForm } from "../interactive/interactive-form";

type FileItem = { id: string; originalName: string; mimeType: string; size: number };

type LectureData = {
  id: string;
  number: number | null;
  title: string;
  date: string;
  summary: string;
  transcript: string;
  subject: { id: string; name: string; emoji: string; color: string; selfStudy?: boolean };
  attachments: FileItem[];
  interactives: { id: string; title: string; description: string; updatedAt: string }[];
  questions: StudyQuestion[];
};

type Neighbor = { id: string; number: number | null; title: string } | null;

export function LectureView({ lecture, prev, next }: { lecture: LectureData; prev: Neighbor; next: Neighbor }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [training, setTraining] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [transcript, setTranscript] = useState(lecture.transcript);
  const [generating, setGenerating] = useState(false);
  const [addingScheme, setAddingScheme] = useState(false);
  // Конспект: актуальный текст из редактора и «перезапуск» редактора, когда ИИ дописал текст
  const summaryRef = useRef(lecture.summary);
  const [summarySeed, setSummarySeed] = useState({ key: 0, text: lecture.summary });
  const [ocr, setOcr] = useState<string | null>(null);
  const ai = useAiEnabled();
  const router = useRouter();
  const toast = useToast();

  // Тема направления «Изучаю»: без записи и фото тетради, слова — «тема»
  const topic = Boolean(lecture.subject.selfStudy);
  const noun = topic ? "Тема" : "Лекция";
  const backHref = topic ? `/learn/${lecture.subject.id}` : `/subjects/${lecture.subject.id}?tab=lectures`;
  const photos = lecture.attachments.filter((a) => a.mimeType.startsWith("image/"));
  const media = lecture.attachments.filter((a) => a.mimeType.startsWith("audio/") || a.mimeType.startsWith("video/"));
  const other = lecture.attachments.filter((a) => !photos.includes(a) && !media.includes(a));
  const learned = lecture.questions.filter((q) => q.status === "LEARNED").length;

  /** Переносит фото тетради в конспект: каждое фото — отдельный запрос к модели со зрением */
  async function recognize(list: FileItem[]) {
    const pieces: string[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const label = list.length > 1 ? `Фото ${i + 1} из ${list.length}` : "Распознаю";
        setOcr(`${label}…`);
        const text = await callWithWait(() => recognizePhoto(list[i].id), (s) => setOcr(s ? `${label} · лимит, жду ${s} с` : `${label}…`));
        if (text) pieces.push(text);
      }
      if (!pieces.length) return;
      const current = summaryRef.current.trim();
      const next = [current, ...pieces].filter(Boolean).join("\n\n---\n\n");
      const r = await saveLectureSummary(lecture.id, next);
      if (!r.ok) throw new Error(r.error);
      summaryRef.current = next;
      setSummarySeed((s) => ({ key: s.key + 1, text: next }));
      toast.push(list.length > 1 ? `Страниц перенесено: ${pieces.length}` : "Страница перенесена в конспект");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Не удалось распознать", "err");
    } finally {
      setOcr(null);
    }
  }

  const sourceText = [summaryRef.current.trim(), transcriptPlainText(transcript)].filter(Boolean).join("\n\n");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {lecture.subject.emoji} {lecture.subject.name}
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-semibold tabular-nums" style={{ background: `${lecture.subject.color}1a`, color: lecture.subject.color }}>
            {lecture.number ?? "—"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">{noun} {lecture.number ?? ""}{lecture.date ? ` · ${formatDate(lecture.date, "d MMMM yyyy")}` : ""}</div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{lecture.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {media.length && !topic ? (
                <Badge>
                  <Headphones className="h-3 w-3" /> {media.length} запис{media.length === 1 ? "ь" : "и"}
                </Badge>
              ) : null}
              {photos.length ? (
                <Badge>
                  <ImageIcon className="h-3 w-3" /> {photos.length} фото
                </Badge>
              ) : null}
              {lecture.questions.length ? (
                <Badge tone={learned === lecture.questions.length ? "success" : "neutral"}>
                  {learned}/{lecture.questions.length} вопросов выучено
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Изменить">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hover:text-danger" onClick={() => setDeleting(true)} aria-label="Удалить">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {!topic ? (
            <>
          {/* Запись лекции */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Headphones className="h-4 w-4 text-muted" /> Запись
              </h2>
              {media.length ? <FileUploader parent={{ lectureId: lecture.id }} compact accept="audio/*,video/*" label="Добавить" /> : null}
            </div>
            {media.length ? (
              <div className="space-y-4">
                {media.map((m) => (
                  <MediaPlayer key={m.id} file={m} />
                ))}
              </div>
            ) : (
              <FileUploader parent={{ lectureId: lecture.id }} accept="audio/*,video/*" label="Загрузи запись лекции" hint="mp3, m4a, wav, mp4 · до 300 МБ" />
            )}
          </section>

          <TranscriptPanel
            lecture={{ id: lecture.id, title: lecture.title, subject: lecture.subject.name }}
            media={media}
            transcript={transcript}
            onChange={setTranscript}
          />
            </>
          ) : null}

          {/* Конспект */}
          <SummaryEditor key={summarySeed.key} lectureId={lecture.id} initial={summarySeed.text} onText={(t) => (summaryRef.current = t)} />

          {/* Интерактивные схемы — запускаются прямо в лекции */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <MonitorPlay className="h-4 w-4 text-muted" /> Интерактивы {lecture.interactives.length ? <span className="font-normal text-muted">{lecture.interactives.length}</span> : null}
              </h2>
              <Button size="sm" variant="secondary" onClick={() => setAddingScheme(true)}>
                <Plus className="h-3.5 w-3.5" /> Схема
              </Button>
            </div>
            {lecture.interactives.length ? (
              <div className="space-y-4">
                {lecture.interactives.map((it) => (
                  <div key={it.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Link href={`/interactives/${it.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">
                        {it.title}
                      </Link>
                      <Link href={`/interactives/${it.id}`} className="text-muted hover:text-fg" title="Открыть отдельно" aria-label="Открыть отдельно">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    {it.description ? <p className="mb-2 text-xs text-muted">{it.description}</p> : null}
                    <InteractiveFrame id={it.id} title={it.title} version={it.updatedAt} autoload={false} height="min(70vh, 620px)" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Симуляции и схемы в HTML — например, из чата с Claude. Запускаются здесь же, в защищённой рамке.</p>
            )}
          </section>

          {!topic ? (
            <>
          {/* Фото тетради */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ImageIcon className="h-4 w-4 text-muted" /> Страницы тетради {photos.length ? <span className="font-normal text-muted">{photos.length}</span> : null}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {photos.length && ai ? (
                  <Button size="sm" variant="secondary" disabled={Boolean(ocr)} onClick={() => void recognize(photos)} title="ИИ перепишет страницы в конспект с формулами">
                    {ocr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
                    {ocr ?? "В конспект"}
                  </Button>
                ) : null}
                {photos.length ? <FileUploader parent={{ lectureId: lecture.id }} compact camera accept="image/*" label="Добавить" /> : null}
              </div>
            </div>
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p, i) => (
                  <button key={p.id} onClick={() => setViewer(i)} className="group relative overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${p.id}`} alt={p.originalName} loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 text-[11px] text-white">{i + 1}</span>
                  </button>
                ))}
              </div>
            ) : (
              <FileUploader parent={{ lectureId: lecture.id }} camera accept="image/*" label="Сфотографируй или загрузи страницы конспекта" hint="Можно выбрать сразу несколько фото" />
            )}
          </section>
            </>
          ) : null}

          {topic || other.length ? (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Материалы</h2>
                {topic ? <FileUploader parent={{ lectureId: lecture.id }} compact label="Добавить" /> : null}
              </div>
              {other.length ? <FileGrid files={other} /> : <p className="text-sm text-muted">PDF, картинки, книги по теме. Ссылки на видео и курсы удобно держать прямо в конспекте.</p>}
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="card">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Вопросы по {topic ? "теме" : "лекции"}</h2>
              <div className="flex items-center gap-2">
                {ai ? (
                  <button onClick={() => setGenerating(true)} className="text-muted hover:text-accent" aria-label="Сделать вопросы ИИ" title="Сделать вопросы из конспекта и расшифровки">
                    <Sparkles className="h-4 w-4" />
                  </button>
                ) : null}
                <button onClick={() => setAdding(true)} className="text-muted hover:text-fg" aria-label="Добавить вопрос">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-1.5">
              {lecture.questions.length ? (
                lecture.questions.map((q) => (
                  <Link key={q.id} href={`/questions/${q.id}`} className="block rounded-xl px-2.5 py-2 transition-colors hover:bg-subtle">
                    <div className="line-clamp-2 text-sm">
                      <Markdown inline>{q.text}</Markdown>
                    </div>
                    <Badge tone={questionStatusTone(q.status)} className="mt-1" dot>
                      {labelOf(QUESTION_STATUSES, q.status)}
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="space-y-2 px-2.5 py-3">
                  <p className="text-sm text-muted">{topic ? "Вопросы для самопроверки — попадут в общее повторение." : "Запиши вопросы, которые могут спросить по этой лекции."}</p>
                  {ai && sourceText.length > 80 ? (
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setGenerating(true)}>
                      <Sparkles className="h-3.5 w-3.5" /> Сделать вопросы из конспекта
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
            {lecture.questions.length ? (
              <div className="border-t border-line p-3">
                <Button className="w-full" variant={training ? "secondary" : "primary"} onClick={() => setTraining((t) => !t)}>
                  {training ? <X className="h-4 w-4" /> : <Play className="h-4 w-4" />} {training ? "Закрыть тренировку" : topic ? "Тренировать тему" : "Тренировать лекцию"}
                </Button>
              </div>
            ) : null}
          </section>

          <nav className="grid grid-cols-2 gap-2">
            {prev ? (
              <Link href={`/lectures/${prev.id}`} className="card card-hover p-3 text-sm">
                <span className="flex items-center gap-1 text-xs text-muted">
                  <ChevronLeft className="h-3 w-3" /> {noun} {prev.number}
                </span>
                <span className="mt-0.5 line-clamp-2">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/lectures/${next.id}`} className="card card-hover p-3 text-right text-sm">
                <span className="flex items-center justify-end gap-1 text-xs text-muted">
                  {noun} {next.number} <ChevronRight className="h-3 w-3" />
                </span>
                <span className="mt-0.5 line-clamp-2">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </aside>
      </div>

      {training ? (
        <div className="mt-6">
          <StudyMode questions={lecture.questions} color={lecture.subject.color} />
        </div>
      ) : null}

      {viewer !== null && photos[viewer] ? <PhotoViewer photos={photos} index={viewer} onChange={setViewer} onClose={() => setViewer(null)} /> : null}

      <Modal open={addingScheme} onClose={() => setAddingScheme(false)} title={topic ? "Схема к теме" : "Схема к лекции"} description="HTML запускается изолированно: у него нет доступа к твоему аккаунту">
        <InteractiveForm lectureId={lecture.id} subjectId={lecture.subject.id} onDone={() => setAddingScheme(false)} />
      </Modal>
      <Modal open={editing} onClose={() => setEditing(false)} title={topic ? "Изменить тему" : "Изменить лекцию"}>
        <LectureForm id={lecture.id} subjectId={lecture.subject.id} initial={{ title: lecture.title, number: lecture.number, date: lecture.date }} topic={topic} onDone={() => setEditing(false)} />
      </Modal>
      <Modal
        open={generating}
        onClose={() => setGenerating(false)}
        title={topic ? "Вопросы по теме" : "Вопросы из лекции"}
        description="ИИ составит вопросы с ответами по конспекту и расшифровке — выбери, какие добавить"
        className="sm:max-w-2xl"
      >
        {generating ? (
          <QuestionGenerator
            subjectId={lecture.subject.id}
            lectureId={lecture.id}
            initialText={sourceText}
            onDone={() => {
              setGenerating(false);
              router.refresh();
            }}
          />
        ) : null}
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title={topic ? "Вопрос по теме" : "Вопрос по лекции"}>
        <QuestionForm subjectId={lecture.subject.id} lectureId={lecture.id} onDone={() => setAdding(false)} />
      </Modal>
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={topic ? "Удалить тему?" : "Удалить лекцию?"}
        text={topic ? "Конспект и файлы темы будут удалены. Вопросы останутся в направлении." : "Записи и фото лекции будут удалены. Вопросы останутся в предмете."}
        onConfirm={async () => {
          const r = await deleteLecture(lecture.id);
          if (!r.ok) {
            toast.push(r.error, "err");
            return;
          }
          toast.push(topic ? "Тема удалена" : "Лекция удалена");
          router.push(backHref);
        }}
      />
    </div>
  );
}

const RATES = [1, 1.25, 1.5, 1.75, 2];

/** Плеер записи: скорость, перемотка на 15 с, запоминает позицию в браузере */
function MediaPlayer({ file }: { file: FileItem }) {
  const ref = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const storageKey = `lecture-pos:${file.id}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved > 5) el.currentTime = saved;
    } catch {
      // нет доступа к хранилищу — не страшно
    }
    const save = () => {
      try {
        localStorage.setItem(storageKey, String(Math.floor(el.currentTime)));
      } catch {
        // игнорируем
      }
    };
    el.addEventListener("pause", save);
    const t = setInterval(save, 5000);
    return () => {
      clearInterval(t);
      el.removeEventListener("pause", save);
    };
  }, [storageKey]);

  // Клик по метке времени в расшифровке
  useEffect(() => {
    const onSeek = (e: Event) => {
      const { fileId, time } = (e as CustomEvent<{ fileId: string | null; time: number }>).detail;
      const el = ref.current;
      if (!el || (fileId && fileId !== file.id)) return;
      el.currentTime = time;
      void el.play().catch(() => undefined);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("lecture-seek", onSeek);
    return () => window.removeEventListener("lecture-seek", onSeek);
  }, [file.id]);

  const isVideo = file.mimeType.startsWith("video/");
  function seek(delta: number) {
    const el = ref.current;
    if (el) el.currentTime = Math.max(0, el.currentTime + delta);
  }
  return (
    <div>
      <div className="mb-1.5 truncate text-[13px] text-muted">{file.originalName}</div>
      {isVideo ? (
        <video ref={ref} src={`/api/files/${file.id}`} controls preload="metadata" className="w-full rounded-xl bg-black" />
      ) : (
        <audio ref={ref} src={`/api/files/${file.id}`} controls preload="metadata" className="w-full" />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Button variant="secondary" size="sm" onClick={() => seek(-15)}>
          −15 с
        </Button>
        <Button variant="secondary" size="sm" onClick={() => seek(15)}>
          +15 с
        </Button>
        <div className="ml-auto inline-flex rounded-lg bg-subtle p-0.5">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRate(r);
                if (ref.current) ref.current.playbackRate = r;
              }}
              className={cn("h-7 rounded-md px-2 text-xs font-medium tabular-nums", rate === r ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}
            >
              {r}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhotoViewer({ photos, index, onChange, onClose }: { photos: FileItem[]; index: number; onChange: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange(Math.min(index + 1, photos.length - 1));
      if (e.key === "ArrowLeft") onChange(Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onChange, onClose]);

  const p = photos[index];
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black/90" role="dialog" aria-label="Просмотр фото">
      <div className="flex items-center justify-between p-3 text-sm text-white/80">
        <span>
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-1">
          <a href={`/api/files/${p.id}?download=1`} className="rounded-lg px-2 py-1 hover:bg-white/10">
            Скачать
          </a>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Закрыть">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/files/${p.id}`} alt={p.originalName} className="max-h-full max-w-full rounded-lg object-contain" />
        {index > 0 ? (
          <button onClick={() => onChange(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Предыдущее">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {index < photos.length - 1 ? (
          <button onClick={() => onChange(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Следующее">
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Конспект лекции в Markdown с формулами и автосохранением */
function SummaryEditor({ lectureId, initial, onText }: { lectureId: string; initial: string; onText?: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const [edit, setEdit] = useState(!initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);
  const toast = useToast();

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState("saving");
    const t = setTimeout(async () => {
      const r = await saveLectureSummary(lectureId, text);
      setState(r.ok ? "saved" : "idle");
      if (!r.ok) toast.push(r.error, "err");
    }, 700);
    return () => clearTimeout(t);
  }, [text, lectureId, toast]);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Конспект</h2>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted">
            {state === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "saved" ? <Check className="h-3 w-3" /> : null}
            {state === "saving" ? "Сохраняю…" : state === "saved" ? "Сохранено" : ""}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEdit((e) => !e)}>
            {edit ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {edit ? "Просмотр" : "Редактировать"}
          </Button>
        </div>
      </div>
      {edit ? (
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onText?.(e.target.value);
          }}
          rows={10}
          autoFocus={!initial}
          placeholder={"Главное с лекции своими словами.\n\n## Определения\n- Предел: $\\lim_{n\\to\\infty} a_n = a$\n\n$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$"}
          className="block min-h-56 w-full resize-y bg-transparent px-4 py-3 font-mono text-[13.5px] leading-relaxed outline-none placeholder:text-muted/60"
        />
      ) : (
        <div className="min-h-24 cursor-text px-4 py-3" onDoubleClick={() => setEdit(true)}>
          {text ? <Markdown className="text-[15px]">{text}</Markdown> : <p className="text-sm text-muted">Пока пусто. Двойной клик — начать писать.</p>}
        </div>
      )}
    </section>
  );
}
