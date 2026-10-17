"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../ui/modal";
import { TaskForm } from "../tasks/task-form";

const HELP = [
  ["Ctrl K  или  /", "Поиск"],
  ["N", "Новая задача"],
  ["R", "Повторение"],
  ["G затем H", "Главная"],
  ["G затем S", "Предметы"],
  ["G затем T", "Задачи"],
  ["G затем C", "Календарь"],
  ["Ctrl J", "Ассистент"],
  ["?", "Эта подсказка"],
  ["Пробел, 1–4", "В тренировке: ответ и оценка"],
];

/** Глобальные горячие клавиши. Не срабатывают, пока курсор в поле ввода. */
export function Hotkeys({ subjects }: { subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (Date.now() - g < 1200) {
        // латиница и те же клавиши в русской раскладке
        const map: Record<string, string> = { h: "/", s: "/subjects", t: "/tasks", c: "/calendar", n: "/notes", f: "/files", р: "/", ы: "/subjects", е: "/tasks", с: "/calendar", т: "/notes", а: "/files" };
        const to = map[k];
        g = 0;
        if (to) {
          e.preventDefault();
          router.push(to);
        }
        return;
      }
      // в тренировке цифры и пробел заняты, буквы — нет
      if (k === "g" || k === "п") g = Date.now();
      else if (k === "n" || k === "т") {
        e.preventDefault();
        setCreating(true);
      } else if (k === "r" || k === "к") {
        e.preventDefault();
        router.push("/review");
      } else if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <Modal open={creating} onClose={() => setCreating(false)} title="Новая задача">
        <TaskForm subjects={subjects} onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={help} onClose={() => setHelp(false)} title="Горячие клавиши">
        <dl className="divide-y divide-line text-sm">
          {HELP.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted">{label}</dt>
              <dd>
                <kbd className="rounded-md border border-line bg-subtle px-1.5 py-0.5 text-xs">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}
