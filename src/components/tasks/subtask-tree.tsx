"use client";

import { useState } from "react";
import { CornerDownRight, Plus, Trash2 } from "lucide-react";
import { createSubtask, deleteSubtask, updateSubtask } from "@/actions/subtasks";
import { subtaskProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { ProgressBar } from "../ui/badge";
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

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-sm font-semibold">Подзадачи</h2>
        {nodes.length ? (
          <>
            <span className="text-xs tabular-nums text-muted">
              {done}/{nodes.length}
            </span>
            <ProgressBar value={progress} className="max-w-40" />
          </>
        ) : null}
      </div>
      <div className="space-y-0.5">
        {roots.map((n) => (
          <SubtaskNode
            key={n.id}
            node={n}
            nodes={nodes}
            taskId={taskId}
            setStatus={(id, s) => setOver((o) => ({ ...o, [id]: s }))}
            remove={(id) => setRemoved((r) => new Set(r).add(id))}
          />
        ))}
      </div>
      <QuickAdd taskId={taskId} parentId={null} />
    </div>
  );
}

function SubtaskNode({
  node,
  nodes,
  taskId,
  setStatus,
  remove,
}: {
  node: Node;
  nodes: Node[];
  taskId: string;
  setStatus: (id: string, status: string) => void;
  remove: (id: string) => void;
}) {
  const children = nodes.filter((i) => i.parentId === node.id);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const isDone = node.status === "DONE";

  return (
    <div>
      <div className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-subtle/60">
        <Checkbox
          size="sm"
          checked={isDone}
          className="mt-0.5"
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
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm", isDone && "text-muted line-through")}>{node.title}</div>
          {node.note ? <div className="text-xs text-muted">{node.note}</div> : null}
        </div>
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
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

function QuickAdd({ taskId, parentId, onDone, autoFocus }: { taskId: string; parentId: string | null; onDone?: () => void; autoFocus?: boolean }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <form
      className="mt-1 flex items-center gap-2 px-2"
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
      <Plus className="h-4 w-4 shrink-0 text-muted" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={parentId ? "Вложенная подзадача" : "Добавить подзадачу"}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone?.();
        }}
        className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {title.trim() ? (
        <Button type="submit" size="sm" loading={busy}>
          Добавить
        </Button>
      ) : null}
    </form>
  );
}
