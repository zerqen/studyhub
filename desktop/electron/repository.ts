import { app, dialog, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ApiException, StudyHubApi } from "./api";
import { MAX_FILE_BYTES, QUICK_ADD_SHORTCUT } from "./constants";
import type { DesktopStore } from "./store";
import type {
  AttachmentDto,
  DesktopPrefs,
  DesktopState,
  LectureDto,
  NoteDto,
  PendingOp,
  PendingOpType,
  TaskDto,
} from "./types";

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".zip")) return "application/zip";
  return "application/octet-stream";
}

function nextSm2(
  repsRaw: number,
  intervalRaw: number,
  easeRaw: number,
  grade: number,
): { srsReps: number; srsInterval: number; srsEase: number; srsDue: string; status: string; srsLapsesDelta: number } {
  let reps = repsRaw;
  let interval = intervalRaw;
  let ease = easeRaw || 2.5;
  let lapsesDelta = 0;

  if (grade < 3) {
    reps = 0;
    interval = 1;
    lapsesDelta = 1;
  } else {
    interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.max(1, Math.round(interval * ease));
    reps += 1;
  }
  const diff = 5 - grade;
  ease = Math.max(1.3, ease + (0.1 - diff * (0.08 + diff * 0.02)));
  const dueDate = new Date(Date.now() + interval * 86_400_000).toISOString();
  const status = grade < 3 ? "LEARNING" : interval >= 14 ? "LEARNED" : "LEARNING";
  return { srsReps: reps, srsInterval: interval, srsEase: ease, srsDue: dueDate, status, srsLapsesDelta: lapsesDelta };
}

export class DesktopRepository {
  private isSyncing = false;
  private lastError: string | null = null;
  private syncQueue: Promise<void> = Promise.resolve();
  private readonly remappedIds = new Map<string, string>();
  private readonly listeners = new Set<(state: DesktopState) => void>();

  constructor(private readonly store: DesktopStore) {
    this.applyLoginSetting(this.store.getData().prefs.openAtLogin);
  }

  onChange(listener: (state: DesktopState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  getState(): DesktopState {
    const data = this.store.getData();
    const token = this.store.getToken();
    const cacheStats = this.store.getCacheStats();
    return {
      session: {
        isLoggedIn: Boolean(token),
        user: data.user,
        lastSyncAt: data.lastSyncAt,
        doneThisWeek: data.doneThisWeek,
        dueReviewCount: data.dueReviewCount,
      },
      prefs: data.prefs,
      snapshot: this.store.toSnapshot(this.isSyncing, this.lastError),
      cachedAttachmentIds: cacheStats.cachedIds,
      cacheFilesCount: cacheStats.count,
      cacheBytes: cacheStats.bytes,
      shortcut: QUICK_ADD_SHORTCUT,
    };
  }

  private enqueueOp(opType: PendingOpType, entityId: string, payload: Record<string, unknown>): void {
    this.store.getData().pendingOps.push({
      id: randomUUID(),
      opType,
      entityId,
      payload,
      createdAt: Date.now(),
    });
    this.store.save();
    this.emit();
  }

  async login(email: string, password: string): Promise<void> {
    const res = await StudyHubApi.login(email, password);
    this.store.setLogin(res.token, res.user);
    this.emit();
    await this.syncNow().catch(() => undefined);
  }

  logout(): void {
    this.store.clearCache();
    this.store.clearAuth();
    this.lastError = null;
    this.isSyncing = false;
    this.emit();
  }

  private applyLoginSetting(openAtLogin: boolean): void {
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin });
    }
  }

  updatePrefs(patch: Partial<DesktopPrefs>): void {
    const data = this.store.getData();
    data.prefs = { ...data.prefs, ...patch };
    if (patch.openAtLogin !== undefined) {
      this.applyLoginSetting(data.prefs.openAtLogin);
    }
    this.store.save();
    this.emit();
  }

  syncNow(): Promise<void> {
    const run = this.syncQueue.then(() => this.performSync());
    this.syncQueue = run.catch(() => undefined);
    return run;
  }

  private async performSync(): Promise<void> {
    const token = this.store.getToken();
    if (!token) return;

    this.isSyncing = true;
    this.lastError = null;
    this.emit();

    const data = this.store.getData();
    try {
      while (data.pendingOps.length > 0) {
        const op = data.pendingOps[0];
        try {
          await this.processOp(token, op);
          data.pendingOps.shift();
          this.store.save();
        } catch (err) {
          if (err instanceof ApiException) {
            if (err.statusCode === 401 || err.statusCode === 403) throw err;
            if (err.statusCode >= 400 && err.statusCode < 500) {
              data.pendingOps.shift();
              this.store.save();
              continue;
            }
          }
          throw err;
        }
      }

      const remote = await StudyHubApi.sync(token);
      data.user = remote.user;
      data.subjects = remote.subjects;
      data.tasks = remote.tasks;
      data.todayEvents = remote.todayEvents;
      data.calendarEvents = remote.calendarEvents;
      data.questions = remote.questions;
      data.notes = remote.notes;
      data.lectures = remote.lectures;
      data.attachments = remote.attachments;
      data.lastSyncAt = Date.now();
      data.doneThisWeek = remote.stats.doneThisWeek;
      data.dueReviewCount = remote.stats.dueReviewCount;
      this.store.save();
      this.lastError = null;
    } catch (err) {
      if (err instanceof ApiException) {
        this.lastError = err.statusCode === 401 ? "Сессия истекла — войдите снова" : err.message;
      } else {
        this.lastError = "Оффлайн — изменения сохранены локально";
      }
    } finally {
      this.isSyncing = false;
      this.emit();
    }
  }

  private async processOp(token: string, op: PendingOp): Promise<void> {
    const data = this.store.getData();
    const resolveId = (id: string) => this.remappedIds.get(id) ?? id;

    switch (op.opType) {
      case "CREATE_TASK": {
        const created = await StudyHubApi.createTask(token, op.payload);
        this.remappedIds.set(op.entityId, created.id);
        data.tasks = [created, ...data.tasks.filter((t) => t.id !== op.entityId && t.id !== created.id)];
        return;
      }
      case "UPDATE_TASK": {
        const id = resolveId(op.entityId);
        if (id.startsWith("local_")) return;
        const updated = await StudyHubApi.updateTask(token, id, op.payload);
        data.tasks = data.tasks.map((t) => (t.id === updated.id ? updated : t));
        return;
      }
      case "DELETE_TASK": {
        const id = resolveId(op.entityId);
        if (!id.startsWith("local_")) await StudyHubApi.deleteTask(token, id);
        return;
      }
      case "CREATE_SUBTASK": {
        const taskId = resolveId(String(op.payload.taskId ?? ""));
        if (!taskId || taskId.startsWith("local_")) return;
        const created = await StudyHubApi.createSubtask(token, taskId, String(op.payload.title ?? ""));
        this.remappedIds.set(op.entityId, created.id);
        data.tasks = data.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...t.subtasks.filter((s) => s.id !== op.entityId && s.id !== created.id), created] }
            : t,
        );
        return;
      }
      case "UPDATE_SUBTASK": {
        const id = resolveId(op.entityId);
        if (id.startsWith("local_")) return;
        const updated = await StudyHubApi.updateSubtask(token, id, op.payload);
        data.tasks = data.tasks.map((t) => ({
          ...t,
          subtasks: t.subtasks.map((s) => (s.id === updated.id ? updated : s)),
        }));
        return;
      }
      case "DELETE_SUBTASK": {
        const id = resolveId(op.entityId);
        if (!id.startsWith("local_")) await StudyHubApi.deleteSubtask(token, id);
        return;
      }
      case "REVIEW_QUESTION": {
        await StudyHubApi.reviewQuestion(token, String(op.payload.questionId), Number(op.payload.grade));
        return;
      }
      case "CREATE_NOTE": {
        const created = await StudyHubApi.createNote(token, op.payload);
        this.remappedIds.set(op.entityId, created.id);
        data.notes = [created, ...data.notes.filter((n) => n.id !== op.entityId && n.id !== created.id)];
        return;
      }
      case "UPDATE_NOTE": {
        const id = resolveId(op.entityId);
        if (id.startsWith("local_")) return;
        const updated = await StudyHubApi.updateNote(token, id, op.payload);
        data.notes = data.notes.map((n) => (n.id === updated.id ? updated : n));
        return;
      }
      case "DELETE_NOTE": {
        const id = resolveId(op.entityId);
        if (!id.startsWith("local_")) await StudyHubApi.deleteNote(token, id);
        return;
      }
      case "CREATE_LECTURE": {
        const created = await StudyHubApi.createLecture(token, op.payload);
        this.remappedIds.set(op.entityId, created.id);
        data.lectures = [created, ...data.lectures.filter((l) => l.id !== op.entityId && l.id !== created.id)];
        return;
      }
      case "UPDATE_LECTURE": {
        const id = resolveId(op.entityId);
        if (id.startsWith("local_")) return;
        const updated = await StudyHubApi.updateLecture(token, id, op.payload);
        data.lectures = data.lectures.map((l) => (l.id === updated.id ? updated : l));
        return;
      }
      case "DELETE_LECTURE": {
        const id = resolveId(op.entityId);
        if (!id.startsWith("local_")) await StudyHubApi.deleteLecture(token, id);
        return;
      }
    }
  }

  toggleTaskDone(taskId: string): void {
    const data = this.store.getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const status = task.status === "DONE" ? "PLANNED" : "DONE";
    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.enqueueOp("UPDATE_TASK", taskId, { status });
    void this.syncNow().catch(() => undefined);
  }

  postponeTaskToTomorrow(taskId: string): void {
    const data = this.store.getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const yyyy = tmr.getFullYear();
    const mm = String(tmr.getMonth() + 1).padStart(2, "0");
    const dd = String(tmr.getDate()).padStart(2, "0");
    const dueDate = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
    task.dueDate = dueDate;
    task.updatedAt = new Date().toISOString();
    this.enqueueOp("UPDATE_TASK", taskId, { dueDate });
    void this.syncNow().catch(() => undefined);
  }

  createTask(input: {
    title: string;
    description?: string | null;
    subjectId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    priority?: string;
    kind?: string;
    stages?: string[];
  }): void {
    const now = new Date().toISOString();
    const localId = `local_task_${randomUUID()}`;
    const stages = (input.stages ?? []).map((s) => s.trim()).filter(Boolean);
    const task: TaskDto = {
      id: localId,
      title: input.title.trim(),
      description: input.description ?? null,
      subjectId: input.subjectId ?? null,
      dueDate: input.dueDate ?? null,
      dueTime: input.dueTime ?? null,
      priority: input.priority ?? "MEDIUM",
      status: "PLANNED",
      kind: input.kind ?? "TASK",
      createdAt: now,
      updatedAt: now,
      subtasks: stages.map((stTitle, idx) => ({
        id: `local_st_${randomUUID()}`,
        taskId: localId,
        title: stTitle,
        status: "PLANNED",
        sortOrder: idx,
        updatedAt: now,
      })),
    };
    this.store.getData().tasks.unshift(task);
    this.enqueueOp("CREATE_TASK", localId, {
      title: task.title,
      description: task.description,
      subjectId: task.subjectId,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
      kind: task.kind,
      stages,
    });
    void this.syncNow().catch(() => undefined);
  }

  updateTask(taskId: string, patch: {
    title?: string;
    description?: string | null;
    subjectId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    priority?: string;
    kind?: string;
  }): void {
    const data = this.store.getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    this.enqueueOp("UPDATE_TASK", taskId, patch);
    void this.syncNow().catch(() => undefined);
  }

  deleteTask(taskId: string): void {
    const data = this.store.getData();
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    data.attachments = data.attachments.filter((a) => a.taskId !== taskId);
    this.enqueueOp("DELETE_TASK", taskId, {});
    void this.syncNow().catch(() => undefined);
  }

  addSubtask(taskId: string, title: string): void {
    const clean = title.trim();
    if (!clean) return;
    const data = this.store.getData();
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const localId = `local_st_${randomUUID()}`;
    task.subtasks.push({
      id: localId,
      taskId,
      title: clean,
      status: "PLANNED",
      sortOrder: task.subtasks.length,
      updatedAt: new Date().toISOString(),
    });
    this.enqueueOp("CREATE_SUBTASK", localId, { taskId, title: clean });
    void this.syncNow().catch(() => undefined);
  }

  toggleSubtaskDone(taskId: string, subtaskId: string): void {
    const data = this.store.getData();
    const task = data.tasks.find((t) => t.id === taskId);
    const st = task?.subtasks.find((s) => s.id === subtaskId);
    if (!st) return;
    const status = st.status === "DONE" ? "PLANNED" : "DONE";
    st.status = status;
    st.updatedAt = new Date().toISOString();
    this.enqueueOp("UPDATE_SUBTASK", subtaskId, { status });
    void this.syncNow().catch(() => undefined);
  }

  deleteSubtask(subtaskId: string): void {
    const data = this.store.getData();
    for (const t of data.tasks) {
      t.subtasks = t.subtasks.filter((s) => s.id !== subtaskId);
    }
    this.enqueueOp("DELETE_SUBTASK", subtaskId, {});
    void this.syncNow().catch(() => undefined);
  }

  reviewQuestion(questionId: string, grade: number): void {
    const data = this.store.getData();
    const q = data.questions.find((x) => x.id === questionId);
    if (q) {
      const next = nextSm2(q.srsReps, q.srsInterval, q.srsEase, grade);
      q.srsReps = next.srsReps;
      q.srsInterval = next.srsInterval;
      q.srsEase = next.srsEase;
      q.srsDue = next.srsDue;
      q.status = next.status;
      q.srsLapses += next.srsLapsesDelta;
    }
    this.enqueueOp("REVIEW_QUESTION", questionId, { questionId, grade });
    void this.syncNow().catch(() => undefined);
  }

  createNote(input: { title: string; content: string; subjectId: string | null; color: string; pinned: boolean }): void {
    const now = new Date().toISOString();
    const localId = `local_note_${randomUUID()}`;
    const note: NoteDto = {
      id: localId,
      title: input.title.trim() || "Без названия",
      content: input.content,
      subjectId: input.subjectId,
      color: input.color,
      pinned: input.pinned,
      createdAt: now,
      updatedAt: now,
    };
    this.store.getData().notes.unshift(note);
    this.enqueueOp("CREATE_NOTE", localId, {
      title: note.title,
      content: note.content,
      subjectId: note.subjectId,
      color: note.color,
      pinned: note.pinned,
    });
    void this.syncNow().catch(() => undefined);
  }

  updateNote(noteId: string, input: { title: string; content: string; subjectId: string | null; color: string; pinned: boolean }): void {
    const data = this.store.getData();
    const note = data.notes.find((n) => n.id === noteId);
    if (!note) return;
    Object.assign(note, { ...input, updatedAt: new Date().toISOString() });
    this.enqueueOp("UPDATE_NOTE", noteId, input);
    void this.syncNow().catch(() => undefined);
  }

  deleteNote(noteId: string): void {
    const data = this.store.getData();
    data.notes = data.notes.filter((n) => n.id !== noteId);
    data.attachments = data.attachments.filter((a) => a.noteId !== noteId);
    this.enqueueOp("DELETE_NOTE", noteId, {});
    void this.syncNow().catch(() => undefined);
  }

  createLecture(input: { subjectId: string; title: string; number: number | null; date: string | null; summary: string }): void {
    const now = new Date().toISOString();
    const localId = `local_lec_${randomUUID()}`;
    const lecture: LectureDto = {
      id: localId,
      subjectId: input.subjectId,
      title: input.title.trim(),
      number: input.number,
      date: input.date,
      summary: input.summary,
      transcript: "",
      createdAt: now,
      updatedAt: now,
    };
    this.store.getData().lectures.unshift(lecture);
    this.enqueueOp("CREATE_LECTURE", localId, {
      subjectId: lecture.subjectId,
      title: lecture.title,
      number: lecture.number,
      date: lecture.date,
      summary: lecture.summary,
      transcript: "",
    });
    void this.syncNow().catch(() => undefined);
  }

  updateLecture(
    lectureId: string,
    input: { title: string; number: number | null; date: string | null; summary: string; transcript: string },
  ): void {
    const data = this.store.getData();
    const lec = data.lectures.find((l) => l.id === lectureId);
    if (!lec) return;
    Object.assign(lec, { ...input, updatedAt: new Date().toISOString() });
    this.enqueueOp("UPDATE_LECTURE", lectureId, input);
    void this.syncNow().catch(() => undefined);
  }

  deleteLecture(lectureId: string): void {
    const data = this.store.getData();
    data.lectures = data.lectures.filter((l) => l.id !== lectureId);
    data.attachments = data.attachments.filter((a) => a.lectureId !== lectureId);
    this.enqueueOp("DELETE_LECTURE", lectureId, {});
    void this.syncNow().catch(() => undefined);
  }

  async transcribeLectureAudio(lectureId: string, attachmentId: string): Promise<string> {
    const token = this.store.getToken();
    if (!token) throw new Error("Нужна авторизация");
    const transcript = await StudyHubApi.transcribeLectureAudio(token, lectureId, attachmentId);
    const data = this.store.getData();
    const lec = data.lectures.find((l) => l.id === lectureId);
    if (lec) {
      lec.transcript = transcript;
      lec.updatedAt = new Date().toISOString();
      this.store.save();
      this.emit();
    }
    return transcript;
  }

  private async ensureCachedFile(att: AttachmentDto): Promise<string> {
    const dest = this.store.cachedFilePath(att);
    if (this.store.isCached(att)) return dest;
    const token = this.store.getToken();
    if (!token) throw new Error("Нужна авторизация");
    await StudyHubApi.downloadAttachment(token, att.id, dest);
    this.emit();
    return dest;
  }

  async openAttachment(attachmentId: string): Promise<void> {
    const att = this.store.getData().attachments.find((a) => a.id === attachmentId);
    if (!att) throw new Error("Файл не найден");
    const filePath = await this.ensureCachedFile(att);
    const openErr = await shell.openPath(filePath);
    if (openErr) throw new Error(openErr);
  }

  async revealAttachment(attachmentId: string): Promise<void> {
    const att = this.store.getData().attachments.find((a) => a.id === attachmentId);
    if (!att) throw new Error("Файл не найден");
    const filePath = await this.ensureCachedFile(att);
    shell.showItemInFolder(filePath);
  }

  async pickAndUploadAttachment(
    parentType: string | null,
    parentId: string | null,
    mode: "all" | "audio" = "all",
  ): Promise<AttachmentDto | null> {
    const filters =
      mode === "audio"
        ? [{ name: "Аудиозаписи", extensions: ["mp3", "m4a", "wav", "ogg", "webm", "flac", "aac", "opus"] }]
        : [{ name: "Все файлы", extensions: ["*"] }];
    const picked = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters,
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    return this.uploadAttachmentFromPath(parentType, parentId, picked.filePaths[0]);
  }

  async uploadAttachmentFromPath(
    parentType: string | null,
    parentId: string | null,
    filePath: string,
  ): Promise<AttachmentDto> {
    const token = this.store.getToken();
    if (!token) throw new Error("Нужна авторизация");

    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) throw new Error("Выбран пустой файл");
    if (stat.size > MAX_FILE_BYTES) throw new Error("Файл больше 300 МБ не поддерживается");

    let targetId = parentId;
    if (targetId && targetId.startsWith("local_")) {
      await this.syncNow();
      targetId = this.remappedIds.get(targetId) ?? targetId;
      if (targetId.startsWith("local_")) {
        throw new Error("Сначала синхронизируйте запись с сервером");
      }
    }

    const bytes = readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = guessMimeFromName(fileName);
    const uploaded = await StudyHubApi.uploadAttachment(token, parentType, targetId, fileName, mimeType, bytes);

    const data = this.store.getData();
    data.attachments = [uploaded, ...data.attachments.filter((a) => a.id !== uploaded.id)];
    this.store.save();

    const cachePath = this.store.cachedFilePath(uploaded);
    mkdirSync(path.dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, bytes);
    this.emit();
    return uploaded;
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    const token = this.store.getToken();
    if (!token) throw new Error("Нужна авторизация");
    const data = this.store.getData();
    const existing = data.attachments.find((a) => a.id === attachmentId);
    await StudyHubApi.deleteAttachment(token, attachmentId);
    data.attachments = data.attachments.filter((a) => a.id !== attachmentId);
    if (existing) {
      const cachePath = this.store.cachedFilePath(existing);
      if (existsSync(cachePath)) {
        try {
          unlinkSync(cachePath);
        } catch {
          // ignore unlink errors
        }
      }
    }
    this.store.save();
    this.emit();
  }

  clearFileCache(): number {
    const removed = this.store.clearCache();
    this.emit();
    return removed;
  }
}
