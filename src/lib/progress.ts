type Countable = { status: string };

export function ratio(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function learnedShare(items: Countable[], learned = "LEARNED") {
  return ratio(items.filter((i) => i.status === learned).length, items.length);
}

export function taskShare(items: Countable[]) {
  return ratio(items.filter((i) => i.status === "DONE").length, items.length);
}

export function subtaskProgress(
  nodes: { id: string; parentId: string | null; status: string }[],
  rootId: string | null = null,
): number {
  const children = nodes.filter((n) => n.parentId === rootId);
  if (!children.length) {
    if (!rootId) return 0;
    const self = nodes.find((n) => n.id === rootId);
    return self?.status === "DONE" ? 100 : 0;
  }
  const scores = children.map((c) => {
    const nested = nodes.some((n) => n.parentId === c.id);
    if (nested) return subtaskProgress(nodes, c.id);
    return c.status === "DONE" ? 100 : 0;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function subjectProgress(input: {
  questions: Countable[];
  tasks: Countable[];
}) {
  const parts: number[] = [];
  if (input.questions.length) parts.push(learnedShare(input.questions));
  if (input.tasks.length) parts.push(taskShare(input.tasks));
  if (!parts.length) return 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}
