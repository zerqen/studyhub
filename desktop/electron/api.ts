import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASE_URL, DIRECT_UPLOAD_THRESHOLD } from "./constants";
import type { AttachmentDto, LectureDto, MobileUserDto, NoteDto, QuestionDto, SubtaskDto, SubjectDto, TaskDto, TodayEventDto } from "./types";

export class ApiException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: MobileUserDto;
}

export interface SyncResponse {
  serverTime: string;
  user: MobileUserDto;
  subjects: SubjectDto[];
  tasks: TaskDto[];
  todayEvents: TodayEventDto[];
  calendarEvents: TodayEventDto[];
  questions: QuestionDto[];
  notes: NoteDto[];
  lectures: LectureDto[];
  attachments: AttachmentDto[];
  stats: {
    doneThisWeek: number;
    openCount: number;
    overdueCount: number;
    dueReviewCount: number;
  };
}

interface BlobGrantResponse {
  pathname: string;
  mimeType: string;
  clientToken: string;
  uploadReceipt: string;
}

async function parseError(res: Response, fallback: string): Promise<ApiException> {
  let msg = fallback;
  try {
    const json = (await res.json()) as { error?: string };
    if (json?.error) msg = json.error;
  } catch {
    // keep fallback
  }
  return new ApiException(res.status, msg);
}

async function requestJson<T>(apiPath: string, init: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE_URL}${apiPath}`, { ...init, headers });
  if (!res.ok) {
    throw await parseError(res, `Ошибка сервера (${res.status})`);
  }
  return (await res.json()) as T;
}

async function requestUnit(apiPath: string, init: RequestInit, token: string): Promise<void> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE_URL}${apiPath}`, { ...init, headers });
  if (!res.ok) {
    throw await parseError(res, `Ошибка сервера (${res.status})`);
  }
}

export const StudyHubApi = {
  login(email: string, password: string): Promise<LoginResponse> {
    return requestJson("/api/mobile/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  },

  sync(token: string): Promise<SyncResponse> {
    return requestJson("/api/mobile/sync", { method: "GET" }, token);
  },

  async createTask(token: string, payload: Record<string, unknown>): Promise<TaskDto> {
    const res = await requestJson<{ task: TaskDto }>(
      "/api/mobile/tasks",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.task;
  },

  async updateTask(token: string, id: string, payload: Record<string, unknown>): Promise<TaskDto> {
    const res = await requestJson<{ task: TaskDto }>(
      `/api/mobile/tasks/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.task;
  },

  deleteTask(token: string, id: string): Promise<void> {
    return requestUnit(`/api/mobile/tasks/${id}`, { method: "DELETE" }, token);
  },

  async createSubtask(token: string, taskId: string, title: string): Promise<SubtaskDto> {
    const res = await requestJson<{ subtask: SubtaskDto }>(
      `/api/mobile/tasks/${taskId}/subtasks`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, status: "PLANNED" }) },
      token,
    );
    return res.subtask;
  },

  async updateSubtask(token: string, id: string, payload: Record<string, unknown>): Promise<SubtaskDto> {
    const res = await requestJson<{ subtask: SubtaskDto }>(
      `/api/mobile/subtasks/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.subtask;
  },

  deleteSubtask(token: string, id: string): Promise<void> {
    return requestUnit(`/api/mobile/subtasks/${id}`, { method: "DELETE" }, token);
  },

  reviewQuestion(token: string, questionId: string, grade: number): Promise<unknown> {
    return requestJson(
      "/api/mobile/review",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, grade }) },
      token,
    );
  },

  async createNote(token: string, payload: Record<string, unknown>): Promise<NoteDto> {
    const res = await requestJson<{ note: NoteDto }>(
      "/api/mobile/notes",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.note;
  },

  async updateNote(token: string, id: string, payload: Record<string, unknown>): Promise<NoteDto> {
    const res = await requestJson<{ note: NoteDto }>(
      `/api/mobile/notes/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.note;
  },

  deleteNote(token: string, id: string): Promise<void> {
    return requestUnit(`/api/mobile/notes/${id}`, { method: "DELETE" }, token);
  },

  async createLecture(token: string, payload: Record<string, unknown>): Promise<LectureDto> {
    const res = await requestJson<{ lecture: LectureDto }>(
      "/api/mobile/lectures",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.lecture;
  },

  async updateLecture(token: string, id: string, payload: Record<string, unknown>): Promise<LectureDto> {
    const res = await requestJson<{ lecture: LectureDto }>(
      `/api/mobile/lectures/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token,
    );
    return res.lecture;
  },

  deleteLecture(token: string, id: string): Promise<void> {
    return requestUnit(`/api/mobile/lectures/${id}`, { method: "DELETE" }, token);
  },

  async transcribeLectureAudio(token: string, lectureId: string, attachmentId: string): Promise<string> {
    const res = await requestJson<{ transcript: string }>(
      `/api/mobile/lectures/${lectureId}/transcribe`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attachmentId }) },
      token,
    );
    return res.transcript;
  },

  async uploadAttachment(
    token: string,
    parentType: string | null,
    parentId: string | null,
    fileName: string,
    mimeType: string,
    bytes: Buffer,
  ): Promise<AttachmentDto> {
    if (bytes.length <= DIRECT_UPLOAD_THRESHOLD) {
      const form = new FormData();
      if (parentType && parentId) form.set(`${parentType}Id`, parentId);
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType || "application/octet-stream" });
      form.set("file", blob, fileName);
      const res = await requestJson<{ attachment: AttachmentDto }>(
        "/api/mobile/files/upload",
        { method: "POST", body: form },
        token,
      );
      return res.attachment;
    }

    const grant = await requestJson<BlobGrantResponse>(
      "/api/mobile/files/blob",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentType: parentType && parentId ? parentType : null,
          parentId: parentType && parentId ? parentId : null,
          name: fileName,
          size: bytes.length,
        }),
      },
      token,
    );

    const cleanPath = grant.pathname.replace(/^\/+/, "");
    if (cleanPath.includes("@") || cleanPath.includes("..")) {
      throw new Error("Некорректный путь загрузки");
    }

    const putRes = await fetch(`https://blob.vercel-storage.com/${cleanPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${grant.clientToken}`,
        "x-api-version": "7",
        "x-content-type": grant.mimeType,
        "x-add-random-suffix": "0",
      },
      body: new Blob([new Uint8Array(bytes)], { type: grant.mimeType }),
    });
    if (!putRes.ok) {
      throw new ApiException(putRes.status, `Ошибка загрузки в Blob (${putRes.status})`);
    }

    const reg = await requestJson<{ attachment: AttachmentDto }>(
      "/api/mobile/files/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadReceipt: grant.uploadReceipt }),
      },
      token,
    );
    return reg.attachment;
  },

  async downloadAttachment(token: string, attachmentId: string, destFile: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/mobile/files/${attachmentId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw await parseError(res, `Не удалось скачать файл (${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(path.dirname(destFile), { recursive: true });
    const tmp = `${destFile}.part`;
    writeFileSync(tmp, buf);
    renameSync(tmp, destFile);
  },

  deleteAttachment(token: string, attachmentId: string): Promise<void> {
    return requestUnit(`/api/mobile/files/${attachmentId}`, { method: "DELETE" }, token);
  },
};
