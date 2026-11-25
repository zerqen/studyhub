export type TaskKind = "HOMEWORK" | "LAB" | "TEST" | "DRAWING" | "TASK";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface MobileUserDto {
  id: string;
  email: string;
  name: string;
  avatarPath?: string | null;
}

export interface SubjectDto {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: string;
  examDate?: string | null;
  questionsTotal: number;
  questionsLearned: number;
  progress: number;
}

export interface SubtaskDto {
  id: string;
  taskId: string;
  parentId?: string | null;
  title: string;
  status: string;
  dueDate?: string | null;
  note?: string | null;
  sortOrder: number;
  updatedAt: string;
}

export interface TaskDto {
  id: string;
  title: string;
  description?: string | null;
  subjectId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority: string;
  status: string;
  kind: string;
  lessonAt?: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: SubtaskDto[];
}

export interface TodayEventDto {
  key: string;
  title: string;
  kind: string;
  kindLabel: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  location?: string | null;
  color: string;
  subjectId?: string | null;
  subjectName?: string | null;
}

export interface QuestionDto {
  id: string;
  subjectId: string;
  text: string;
  answer?: string | null;
  explanation?: string | null;
  status: string;
  difficulty: string;
  kind: string;
  ticketNo?: number | null;
  ticketTitle?: string | null;
  lectureTitle?: string | null;
  srsDue?: string | null;
  srsInterval: number;
  srsEase: number;
  srsReps: number;
  srsLapses: number;
  sortOrder: number;
}

export interface NoteDto {
  id: string;
  title: string;
  content: string;
  subjectId?: string | null;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LectureDto {
  id: string;
  subjectId: string;
  number?: number | null;
  title: string;
  date?: string | null;
  summary: string;
  transcript: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  subjectId?: string | null;
  taskId?: string | null;
  noteId?: string | null;
  lectureId?: string | null;
  questionId?: string | null;
  createdAt: string;
  folder: string;
  folderName: string;
  folderColor?: string | null;
  folderSelfStudy: boolean;
  whereLabel: string;
}

export type PendingOpType =
  | "CREATE_TASK"
  | "UPDATE_TASK"
  | "DELETE_TASK"
  | "CREATE_SUBTASK"
  | "UPDATE_SUBTASK"
  | "DELETE_SUBTASK"
  | "REVIEW_QUESTION"
  | "CREATE_NOTE"
  | "UPDATE_NOTE"
  | "DELETE_NOTE"
  | "CREATE_LECTURE"
  | "UPDATE_LECTURE"
  | "DELETE_LECTURE";

export interface PendingOp {
  id: string;
  opType: PendingOpType;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface DesktopPrefs {
  themeMode: "system" | "light" | "dark";
  showLessons: boolean;
  minimizeToTray: boolean;
  openAtLogin: boolean;
  notifMorningEnabled: boolean;
  notifMorningHour: number;
  notifMorningMinute: number;
  notifEveningEnabled: boolean;
  notifEveningHour: number;
  notifEveningMinute: number;
}

export interface DesktopSnapshot {
  subjects: SubjectDto[];
  tasks: TaskDto[];
  todayEvents: TodayEventDto[];
  calendarEvents: TodayEventDto[];
  questions: QuestionDto[];
  notes: NoteDto[];
  lectures: LectureDto[];
  attachments: AttachmentDto[];
  pendingOpsCount: number;
  isSyncing: boolean;
  lastError: string | null;
}

export interface DesktopSession {
  isLoggedIn: boolean;
  user: MobileUserDto | null;
  lastSyncAt: number;
  doneThisWeek: number;
  dueReviewCount: number;
}

export interface DesktopState {
  session: DesktopSession;
  prefs: DesktopPrefs;
  snapshot: DesktopSnapshot;
  cachedAttachmentIds: string[];
  cacheFilesCount: number;
  cacheBytes: number;
  shortcut: string;
}
