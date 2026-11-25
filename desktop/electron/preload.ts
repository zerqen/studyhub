import { contextBridge, ipcRenderer } from "electron";
import type { DesktopPrefs, DesktopState } from "./types";

const api = {
  getState: (): Promise<DesktopState> => ipcRenderer.invoke("state:get"),
  onStateChange: (cb: (state: DesktopState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: DesktopState) => cb(state);
    ipcRenderer.on("state:changed", listener);
    return () => ipcRenderer.removeListener("state:changed", listener);
  },

  login: (email: string, password: string): Promise<void> => ipcRenderer.invoke("auth:login", email, password),
  logout: (): Promise<void> => ipcRenderer.invoke("auth:logout"),
  syncNow: (): Promise<void> => ipcRenderer.invoke("sync:now"),

  toggleTask: (taskId: string): Promise<void> => ipcRenderer.invoke("task:toggle", taskId),
  postponeTask: (taskId: string): Promise<void> => ipcRenderer.invoke("task:postpone", taskId),
  createTask: (input: {
    title: string;
    description?: string | null;
    subjectId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    priority?: string;
    kind?: string;
    stages?: string[];
  }): Promise<void> => ipcRenderer.invoke("task:create", input),
  updateTask: (taskId: string, patch: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke("task:update", taskId, patch),
  deleteTask: (taskId: string): Promise<void> => ipcRenderer.invoke("task:delete", taskId),

  addSubtask: (taskId: string, title: string): Promise<void> => ipcRenderer.invoke("subtask:add", taskId, title),
  toggleSubtask: (taskId: string, subtaskId: string): Promise<void> =>
    ipcRenderer.invoke("subtask:toggle", taskId, subtaskId),
  deleteSubtask: (subtaskId: string): Promise<void> => ipcRenderer.invoke("subtask:delete", subtaskId),

  reviewQuestion: (questionId: string, grade: number): Promise<void> =>
    ipcRenderer.invoke("question:review", questionId, grade),

  createNote: (input: Record<string, unknown>): Promise<void> => ipcRenderer.invoke("note:create", input),
  updateNote: (noteId: string, input: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke("note:update", noteId, input),
  deleteNote: (noteId: string): Promise<void> => ipcRenderer.invoke("note:delete", noteId),

  createLecture: (input: Record<string, unknown>): Promise<void> => ipcRenderer.invoke("lecture:create", input),
  updateLecture: (lectureId: string, input: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke("lecture:update", lectureId, input),
  deleteLecture: (lectureId: string): Promise<void> => ipcRenderer.invoke("lecture:delete", lectureId),
  transcribeLectureAudio: (lectureId: string, attachmentId: string): Promise<string> =>
    ipcRenderer.invoke("lecture:transcribe", lectureId, attachmentId),

  pickAndUploadAttachment: (parentType: string | null, parentId: string | null, mode?: "all" | "audio") =>
    ipcRenderer.invoke("file:pickUpload", parentType, parentId, mode ?? "all"),
  uploadAttachmentFromPath: (parentType: string | null, parentId: string | null, filePath: string) =>
    ipcRenderer.invoke("file:uploadPath", parentType, parentId, filePath),
  openAttachment: (attachmentId: string): Promise<void> => ipcRenderer.invoke("file:open", attachmentId),
  revealAttachment: (attachmentId: string): Promise<void> => ipcRenderer.invoke("file:reveal", attachmentId),
  deleteAttachment: (attachmentId: string): Promise<void> => ipcRenderer.invoke("file:delete", attachmentId),
  clearFileCache: (): Promise<number> => ipcRenderer.invoke("file:clearCache"),

  updatePrefs: (patch: Partial<DesktopPrefs>): Promise<void> => ipcRenderer.invoke("prefs:update", patch),
  sendTestNotification: (): Promise<void> => ipcRenderer.invoke("notif:test"),
  hideQuickAdd: (): Promise<void> => ipcRenderer.invoke("window:hideQuickAdd"),
  focusMainWindow: (): Promise<void> => ipcRenderer.invoke("window:focusMain"),
};

contextBridge.exposeInMainWorld("studyhub", api);

export type StudyHubDesktopApi = typeof api;
