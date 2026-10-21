"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, Upload } from "lucide-react";
import { createInteractive, updateInteractive } from "@/actions/interactives";
import { MAX_INTERACTIVE_BYTES, htmlTitle } from "@/lib/interactive";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/field";
import { Segmented } from "../ui/page";
import { useToast } from "../ui/toast";

export type SubjectOption = { id: string; name: string; emoji: string; lectures: { id: string; title: string; number: number | null }[] };

type Initial = { id: string; title: string; description: string; subjectId: string | null; lectureId: string | null };

/**
 * Добавление и правка схемы. HTML — файлом (.html) или вставкой кода из чата.
 * Предмет и лекцию можно выбрать, если передан список subjects; иначе берутся subjectId/lectureId.
 */
export function InteractiveForm({
  initial,
  subjectId,
  lectureId,
  subjects,
  onDone,
}: {
  initial?: Initial;
  subjectId?: string;
  lectureId?: string;
  subjects?: SubjectOption[];
  onDone: (id: string) => void;
}) {
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [subject, setSubject] = useState(initial?.subjectId ?? subjectId ?? "");
  const [lecture, setLecture] = useState(initial?.lectureId ?? lectureId ?? "");
  const [source, setSource] = useState<"file" | "code">("file");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const lectures = subjects?.find((s) => s.id === subject)?.lectures ?? [];

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_INTERACTIVE_BYTES) return setErr("Файл больше 5 МБ");
    const text = await file.text();
    setErr(undefined);
    setHtml(text);
    setFileName(file.name);
    if (!title) setTitle(htmlTitle(text) || file.name.replace(/\.html?$/i, ""));
  }

  function onCode(text: string) {
    setHtml(text);
    if (!title) {
      const t = htmlTitle(text);
      if (t) setTitle(t);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing && !html.trim()) return setErr(source === "file" ? "Выбери .html-файл" : "Вставь код страницы");
    setBusy(true);
    setErr(undefined);
    const parents = subjects ? { subjectId: subject || null, lectureId: lecture || null } : {};
    const r = editing
      ? await updateInteractive(initial!.id, { title, description, ...parents, ...(html.trim() ? { html } : {}) })
      : await createInteractive({ title, description, html, subjectId: subjects ? subject || null : subjectId ?? null, lectureId: subjects ? lecture || null : lectureId ?? null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast.push(editing ? "Схема сохранена" : "Схема добавлена");
    router.refresh();
    onDone(editing ? initial!.id : (r.data as { id: string }).id);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-fg/80">{editing ? "Заменить HTML (необязательно)" : "Страница"}</span>
          <Segmented value={source} onChange={setSource} options={[["file", "Файл"], ["code", "Вставить код"]] as const} />
        </div>
        {source === "file" ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-4 py-5 text-left text-sm transition-colors hover:border-accent/40 hover:bg-subtle/40"
          >
            {fileName ? <FileCode2 className="h-5 w-5 shrink-0 text-accent" /> : <Upload className="h-5 w-5 shrink-0 text-muted" />}
            <span className="min-w-0">
              <span className="block truncate font-medium">{fileName || "Выбрать .html-файл"}</span>
              <span className="block text-xs text-muted">Например, симуляция из чата с Claude · до 5 МБ</span>
            </span>
          </button>
        ) : (
          <Textarea
            value={html}
            onChange={(e) => onCode(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={"<!doctype html>\n<html>…</html>"}
            className="font-mono text-xs"
          />
        )}
        <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      </div>

      <Field label="Название">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Возьмётся из <title>, если оставить пустым" maxLength={160} required={editing} />
      </Field>
      <Field label="Описание" hint="Что показывает схема, что покрутить">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
      </Field>

      {subjects ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Предмет">
            <Select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setLecture("");
              }}
            >
              <option value="">Без предмета</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Лекция">
            <Select value={lecture} onChange={(e) => setLecture(e.target.value)} disabled={!lectures.length}>
              <option value="">—</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.number ? `${l.number}. ` : ""}
                  {l.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {err ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          {editing ? "Сохранить" : "Добавить"}
        </Button>
      </div>
    </form>
  );
}
