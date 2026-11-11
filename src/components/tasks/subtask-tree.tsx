"use client";

import { useState } from "react";
import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { createSubtask, deleteSubtask, updateSubtask } from "@/actions/subtasks";
import { subtaskProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { Checkbox } from "./checkbox";

type Node = {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  note: string | null;
  dueDate: Date | string | null;
};

export function SubtaskTree({ taskId, items }: { taskId: string; items: Node[] }) {
  // Локальные переопределения статусов — отметка видна сразу
  const [over, setOver] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const nodes = items.filter((i) => !removed.has(i.id)).map((i) => ({ ...i, status: over[i.id] ?? i.status }));
  const progress = subtaskProgress(nodes);
  const roots = nodes.filter((i) => !i.parentId);
  const done = nodes.filter((n) => n.status === "DONE").length;
  // Без вложенности подзадачи раскладываются плиткой, как в макете; с вложенностью — деревом
  const flat = !nodes.some((n) => n.parentId);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <h2 className="heading text-xl">Подзадачи</h2>
        {nodes.length ? (
          <>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E7E3DA] dark:bg-subtle" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Подзадачи выполнены">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </span>
            <span className="text-[13px] tabular-nums text-muted">
              {done} из {nodes.length}
            </span>
          </>
        ) : null}
      </div>
      <div className={flat ? "grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-1.5" : "space-y-0.5"}>
        {roots.map((n) => (
          <SubtaskNode
            key={n.id}
            node={n}
            nodes={nodes}
            taskId={taskId}
            setStatus={(id, s) => setOver((o) => ({ ...o, [id]: s }))}
            remove={(id) => setRemoved((r) => new Set(r).add(id))}
            tile={flat}
          />
        ))}
      </div>
      <QuickAdd taskId={taskId} parentId={null} root />
    </div>
  );
}

function SubtaskNode({
  node,
  nodes,
  taskId,
  setStatus,
  remove,
  tile,
}: {
  node: Node;
  nodes: Node[];
  taskId: string;
  setStatus: (id: string, status: string) => void;
  remove: (id: string) => void;
  tile?: boolean;
}) {
  const children = nodes.filter((i) => i.parentId === node.id);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const isDone = node.status === "DONE";

  return (
    <div>
      <div
        className={cn(
          "group flex gap-2.5 transition-colors",
          tile
            ? cn("min-h-10 items-center rounded-[10px] border px-3", isDone ? "border-[#ECE8DF] bg-[#F8F6F1] dark:border-line dark:bg-subtle" : "border-line bg-surface hover:bg-subtle/60")
            : "items-start rounded-lg px-2 py-1.5 hover:bg-subtle/60",
        )}
      >
        <Checkbox
          size="sm"
          checked={isDone}
          className={tile ? undefined : "mt-0.5"}
          label={isDone ? `Вернуть: ${node.title}` : `Сделано: ${node.title}`}
          onChange={async () => {
            const next = isDone ? "PLANNED" : "DONE";
            setStatus(node.id, next);
            const res = await updateSubtask(node.id, { taskId, title: node.title, status: next });
            if (!res.ok) {
              toast.push(res.error, "err");
              setStatus(node.id, node.status);
            }
          }}
        />
        <div className="min-w-0 flex-1 py-1">
          <div className={cn("text-sm", isDone && "text-muted line-through")}>{node.title}</div>
          {node.note ? <div className="text-xs text-muted">{node.note}</div> : null}
        </div>
        <div className={cn("flex gap-0.5", tile ? "hidden group-focus-within:flex group-hover:flex max-sm:flex" : "opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100")}>
          <button className="rounded p-1 text-muted hover:bg-subtle hover:text-fg" onClick={() => setAdding((v) => !v)} aria-label="Добавить вложенную">
            <CornerDownRight className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
            aria-label="Удалить"
            onClick={async () => {
              remove(node.id);
              const r = await deleteSubtask(node.id);
              if (!r.ok) toast.push(r.error, "err");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {children.length || adding ? (
        <div className="ml-[17px] border-l border-line pl-2">
          {children.map((c) => (
            <SubtaskNode key={c.id} node={c} nodes={nodes} taskId={taskId} setStatus={setStatus} remove={remove} />
          ))}
          {adding ? <QuickAdd taskId={taskId} parentId={node.id} onDone={() => setAdding(false)} autoFocus /> : null}
        </div>
      ) : null}
    </div>
  );
}

function QuickAdd({ taskId, parentId, onDone, autoFocus, root }: { taskId: string; parentId: string | null; onDone?: () => void; autoFocus?: boolean; root?: boolean }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <form
      className={root ? "flex h-10 items-center gap-2 rounded-[10px] border border-dashed border-[#CFC9B8] bg-[#F8F6F1] px-3 focus-within:border-accent/60 dark:border-line dark:bg-subtle" : "mt-1 flex items-center gap-2 px-2"}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        const res = await createSubtask({ taskId, parentId, title });
        setBusy(false);
        if (!res.ok) toast.push(res.error, "err");
        else {
          setTitle("");
          onDone?.();
        }
      }}
    >
      {root ? null : <Plus className="h-4 w-4 shrink-0 text-muted" />}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={parentId ? "Вложенная подзадача" : "+ подзадача, Enter — добавить"}
        aria-label={parentId ? "Новая вложенная подзадача" : "Новая подзадача"}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone?.();
        }}
        className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {title.trim() ? (
        <Button type="submit" size="sm" loading={busy} className={root ? "h-7" : undefined}>
          Добавить
        </Button>
      ) : null}
    </form>
  );
}
