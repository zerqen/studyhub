export const mobileTaskSelect = {
  id: true,
  title: true,
  description: true,
  subjectId: true,
  startDate: true,
  dueDate: true,
  dueTime: true,
  priority: true,
  status: true,
  kind: true,
  lessonAt: true,
  createdAt: true,
  updatedAt: true,
  subtasks: {
    select: {
      id: true,
      taskId: true,
      parentId: true,
      title: true,
      status: true,
      dueDate: true,
      note: true,
      sortOrder: true,
      updatedAt: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
};

export function serializeMobileTask(t: {
  id: string;
  title: string;
  description: string | null;
  subjectId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  dueTime: string | null;
  priority: string;
  status: string;
  kind: string;
  lessonAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subtasks: {
    id: string;
    taskId: string;
    parentId: string | null;
    title: string;
    status: string;
    dueDate: Date | null;
    note: string | null;
    sortOrder: number;
    updatedAt: Date;
  }[];
}) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    subjectId: t.subjectId,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    dueTime: t.dueTime,
    priority: t.priority,
    status: t.status,
    kind: t.kind,
    lessonAt: t.lessonAt ? t.lessonAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    subtasks: t.subtasks.map((st) => ({
      id: st.id,
      taskId: st.taskId,
      parentId: st.parentId,
      title: st.title,
      status: st.status,
      dueDate: st.dueDate ? st.dueDate.toISOString() : null,
      note: st.note,
      sortOrder: st.sortOrder,
      updatedAt: st.updatedAt.toISOString(),
    })),
  };
}
