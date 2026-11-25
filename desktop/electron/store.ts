import { app, safeStorage } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AttachmentDto,
  DesktopPrefs,
  DesktopSnapshot,
  LectureDto,
  MobileUserDto,
  NoteDto,
  PendingOp,
  QuestionDto,
  SubjectDto,
  TaskDto,
  TodayEventDto,
} from "./types";

interface PersistedData {
  version: number;
  tokenEncrypted: string | null;
  tokenPlainFallback: string | null;
  user: MobileUserDto | null;
  lastSyncAt: number;
  doneThisWeek: number;
  dueReviewCount: number;
  prefs: DesktopPrefs;
  subjects: SubjectDto[];
  tasks: TaskDto[];
  todayEvents: TodayEventDto[];
  calendarEvents: TodayEventDto[];
  questions: QuestionDto[];
  notes: NoteDto[];
  lectures: LectureDto[];
  attachments: AttachmentDto[];
  pendingOps: PendingOp[];
  lastDigestDates: Record<string, string>;
}

const DEFAULT_PREFS: DesktopPrefs = {
  themeMode: "system",
  showLessons: false,
  minimizeToTray: true,
  openAtLogin: false,
  notifMorningEnabled: true,
  notifMorningHour: 8,
  notifMorningMinute: 0,
  notifEveningEnabled: true,
  notifEveningHour: 20,
  notifEveningMinute: 0,
};

function createEmptyData(): PersistedData {
  return {
    version: 1,
    tokenEncrypted: null,
    tokenPlainFallback: null,
    user: null,
    lastSyncAt: 0,
    doneThisWeek: 0,
    dueReviewCount: 0,
    prefs: { ...DEFAULT_PREFS },
    subjects: [],
    tasks: [],
    todayEvents: [],
    calendarEvents: [],
    questions: [],
    notes: [],
    lectures: [],
    attachments: [],
    pendingOps: [],
    lastDigestDates: {},
  };
}

export class DesktopStore {
  private readonly storePath: string;
  private readonly cacheDir: string;
  private data: PersistedData;

  constructor() {
    const userData = app.getPath("userData");
    mkdirSync(userData, { recursive: true });
    this.storePath = path.join(userData, "studyhub-store.json");
    this.cacheDir = path.join(userData, "files-cache");
    mkdirSync(this.cacheDir, { recursive: true });
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): PersistedData {
    if (!existsSync(this.storePath)) return createEmptyData();
    try {
      const raw = readFileSync(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedData>;
      return {
        ...createEmptyData(),
        ...parsed,
        prefs: { ...DEFAULT_PREFS, ...(parsed.prefs ?? {}) },
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        todayEvents: Array.isArray(parsed.todayEvents) ? parsed.todayEvents : [],
        calendarEvents: Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        lectures: Array.isArray(parsed.lectures) ? parsed.lectures : [],
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        pendingOps: Array.isArray(parsed.pendingOps) ? parsed.pendingOps : [],
        lastDigestDates: parsed.lastDigestDates ?? {},
      };
    } catch {
      return createEmptyData();
    }
  }

  save(): void {
    const tmp = `${this.storePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(tmp, this.storePath);
  }

  getToken(): string | null {
    if (this.data.tokenEncrypted && safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(this.data.tokenEncrypted, "base64"));
      } catch {
        return null;
      }
    }
    return this.data.tokenPlainFallback;
  }

  setLogin(token: string, user: MobileUserDto): void {
    if (safeStorage.isEncryptionAvailable()) {
      this.data.tokenEncrypted = safeStorage.encryptString(token).toString("base64");
      this.data.tokenPlainFallback = null;
    } else {
      this.data.tokenEncrypted = null;
      this.data.tokenPlainFallback = token;
    }
    this.data.user = user;
    this.save();
  }

  clearAuth(): void {
    this.data.tokenEncrypted = null;
    this.data.tokenPlainFallback = null;
    this.data.user = null;
    this.data.lastSyncAt = 0;
    this.data.doneThisWeek = 0;
    this.data.dueReviewCount = 0;
    this.data.subjects = [];
    this.data.tasks = [];
    this.data.todayEvents = [];
    this.data.calendarEvents = [];
    this.data.questions = [];
    this.data.notes = [];
    this.data.lectures = [];
    this.data.attachments = [];
    this.data.pendingOps = [];
    this.save();
  }

  getData(): PersistedData {
    return this.data;
  }

  toSnapshot(isSyncing: boolean, lastError: string | null): DesktopSnapshot {
    return {
      subjects: this.data.subjects,
      tasks: this.data.tasks,
      todayEvents: this.data.todayEvents,
      calendarEvents: this.data.calendarEvents,
      questions: this.data.questions,
      notes: this.data.notes,
      lectures: this.data.lectures,
      attachments: this.data.attachments,
      pendingOpsCount: this.data.pendingOps.length,
      isSyncing,
      lastError,
    };
  }

  cachedFilePath(att: AttachmentDto): string {
    const safeName = att.originalName.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 120) || "file";
    return path.join(this.cacheDir, `${att.id}_${safeName}`);
  }

  isCached(att: AttachmentDto): boolean {
    const p = this.cachedFilePath(att);
    if (!existsSync(p)) return false;
    try {
      return statSync(p).size > 0;
    } catch {
      return false;
    }
  }

  getCacheStats(): { count: number; bytes: number; cachedIds: string[] } {
    if (!existsSync(this.cacheDir)) return { count: 0, bytes: 0, cachedIds: [] };
    let count = 0;
    let bytes = 0;
    for (const entry of readdirSync(this.cacheDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      count++;
      try {
        bytes += statSync(path.join(this.cacheDir, entry.name)).size;
      } catch {
        // ignore stat errors
      }
    }
    const cachedIds = this.data.attachments.filter((a) => this.isCached(a)).map((a) => a.id);
    return { count, bytes, cachedIds };
  }

  clearCache(): number {
    if (!existsSync(this.cacheDir)) return 0;
    let removed = 0;
    for (const entry of readdirSync(this.cacheDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      try {
        unlinkSync(path.join(this.cacheDir, entry.name));
        removed++;
      } catch {
        // ignore unlink errors
      }
    }
    return removed;
  }
}
