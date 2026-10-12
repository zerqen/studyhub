"use client";

import { useState } from "react";
import { createSubtask, deleteSubtask, updateSubtask } from "@/actions/subtasks";
import { subtaskProgress } from "@/lib/progress";
import { Button } from "../ui/button";
import { Input } from "../ui/field";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/toast";
import { ProgressBar } from "../ui/badge";

type Node = {
  id: string;
  parentId: string | null;
  title: string;
  status: string;
  note: string | null;
  dueDate: Date | string | null;
};

export function SubtaskTree({ taskId, items }: { taskId: string; items: Node[] }) {
  const router = useRouter();
  const progress = subtaskProgress(items);
  const roots = items.filter((i) => !i.parentId);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span>Подзадачи</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>
      {roots.map((n) => (
        <SubtaskNode key={n.id} node={n} items={items} taskId={taskId} />
      ))}
      <QuickAdd taskId={taskId} parentId={null} onDone={() => router.refresh()} />
    </div>
  );
}

function SubtaskNode({ node, items, taskId }: { node: Node; items: Node[]; taskId: string }) {
  const children = items.filter((i) => i.parentId === node.id);
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-black/5 p-3 dark:border-white/10">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={node.status === "DONE"}
          onChange={async () => {
            const res = await updateSubtask(node.id, {
              taskId,
              title: node.title,
              status: node.status === "DONE" ? "PLANNED" : "DONE",
            });
            if (!res.ok) toast.push(res.error, "err");
            router.refresh();
          }}
        />
        <div className="min-w-0 flex-1">
          <div className={node.status === "DONE" ? "text-[var(--muted)] line-through" : "font-medium"}>{node.title}</div>
          {node.note ? <div className="text-xs text-[var(--muted)]">{node.note}</div> : null}
        </div>
        <button className="text-xs underline" onClick={() => setAdding((v) => !v)}>
          + подзадача
        </button>
        <button
          className="text-xs text-rose-600"
          onClick={async () => {
            await deleteSubtask(node.id);
            router.refresh();
          }}
        >
          удалить
        </button>
      </div>
      {adding ? <QuickAdd taskId={taskId} parentId={node.id} onDone={() => { setAdding(false); router.refresh(); }} /> : null}
      {children.length ? (
        <div className="ml-5 mt-2 space-y-2 border-l border-black/10 pl-3 dark:border-white/10">
          {children.map((c) => (
            <SubtaskNode key={c.id} node={c} items={items} taskId={taskId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuickAdd({
  taskId,
  parentId,
  onDone,
}: {
  taskId: string;
  parentId: string | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const toast = useToast();
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await createSubtask({ taskId, parentId, title });
        if (!res.ok) toast.push(res.error, "err");
        else {
          setTitle("");
          onDone();
        }
      }}
    >
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая подзадача" required />
      <Button type="submit">Добавить</Button>
    </form>
  );
}
