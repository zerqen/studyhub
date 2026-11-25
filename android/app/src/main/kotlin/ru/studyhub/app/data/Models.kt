package ru.studyhub.app.data

import kotlinx.serialization.Serializable

enum class TaskKind(val wire: String, val shortLabel: String, val fullLabel: String) {
  HOMEWORK("HOMEWORK", "ДЗ", "Домашка"),
  LAB("LAB", "Лаба", "Лабораторная"),
  TEST("TEST", "КР", "Контрольная"),
  DRAWING("DRAWING", "Чертёж", "Чертёж"),
  TASK("TASK", "Другое", "Задача");

  companion object {
    fun fromWire(value: String?): TaskKind =
      entries.firstOrNull { it.wire.equals(value, ignoreCase = true) } ?: TASK

    val stageTemplates: Map<TaskKind, List<String>> = mapOf(
      LAB to listOf(
        "Прочитать методичку",
        "Теория в конспект",
        "Подготовить таблицы",
        "Выполнить на паре",
        "Расчёты и графики",
        "Оформить отчёт",
        "Выучить вопросы к защите",
        "Защитить",
      ),
      TEST to listOf(
        "Составить список тем",
        "Повторить конспекты",
        "Прорешать типовые задачи",
        "Решить пробный вариант",
        "Разобрать ошибки",
      ),
      DRAWING to listOf(
        "Получить вариант и задание",
        "Эскиз",
        "Чертёж",
        "Проверить по методичке",
        "Сдать",
      ),
    )
  }
}

enum class TaskPriority(val wire: String, val label: String) {
  LOW("LOW", "Низкий"),
  MEDIUM("MEDIUM", "Обычный"),
  HIGH("HIGH", "Высокий"),
  CRITICAL("CRITICAL", "Срочный");

  companion object {
    fun fromWire(value: String?): TaskPriority =
      entries.firstOrNull { it.wire.equals(value, ignoreCase = true) } ?: MEDIUM
  }
}

@Serializable
data class MobileUserDto(
  val id: String,
  val email: String,
  val name: String,
  val avatarPath: String? = null,
)

@Serializable
data class LoginRequest(
  val email: String,
  val password: String,
)

@Serializable
data class LoginResponse(
  val token: String,
  val expiresAt: String,
  val user: MobileUserDto,
)

@Serializable
data class SubjectDto(
  val id: String,
  val name: String,
  val emoji: String = "📘",
  val color: String = "#2d5bd2",
  val type: String = "EXAM",
  val examDate: String? = null,
  val questionsTotal: Int = 0,
  val questionsLearned: Int = 0,
  val progress: Int = 0,
)

@Serializable
data class SubtaskDto(
  val id: String,
  val taskId: String,
  val parentId: String? = null,
  val title: String,
  val status: String = "PLANNED",
  val dueDate: String? = null,
  val note: String? = null,
  val sortOrder: Int = 0,
  val updatedAt: String = "",
)

@Serializable
data class TaskDto(
  val id: String,
  val title: String,
  val description: String? = null,
  val subjectId: String? = null,
  val startDate: String? = null,
  val dueDate: String? = null,
  val dueTime: String? = null,
  val priority: String = "MEDIUM",
  val status: String = "PLANNED",
  val kind: String = "TASK",
  val lessonAt: String? = null,
  val createdAt: String = "",
  val updatedAt: String = "",
  val subtasks: List<SubtaskDto> = emptyList(),
)

@Serializable
data class TodayEventDto(
  val key: String,
  val title: String,
  val kind: String = "OTHER",
  val kindLabel: String = "Пара",
  val start: String,
  val end: String? = null,
  val allDay: Boolean = false,
  val location: String? = null,
  val color: String = "#2d5bd2",
  val subjectId: String? = null,
  val subjectName: String? = null,
)

@Serializable
data class SyncStatsDto(
  val doneThisWeek: Int = 0,
  val openCount: Int = 0,
  val overdueCount: Int = 0,
  val dueReviewCount: Int = 0,
)

@Serializable
data class QuestionDto(
  val id: String,
  val subjectId: String,
  val text: String,
  val answer: String? = null,
  val explanation: String? = null,
  val status: String = "UNLEARNED",
  val difficulty: String = "MEDIUM",
  val kind: String = "THEORY",
  val ticketNo: Int? = null,
  val ticketTitle: String? = null,
  val lectureTitle: String? = null,
  val srsDue: String? = null,
  val srsInterval: Int = 0,
  val srsEase: Double = 2.5,
  val srsReps: Int = 0,
  val srsLapses: Int = 0,
  val sortOrder: Int = 0,
)

@Serializable
data class ReviewRequest(
  val questionId: String,
  val grade: Int,
)

@Serializable
data class ReviewResponse(
  val status: String,
  val due: String,
)

@Serializable
data class NoteDto(
  val id: String,
  val title: String,
  val content: String = "",
  val subjectId: String? = null,
  val color: String = "#fde68a",
  val pinned: Boolean = false,
  val createdAt: String = "",
  val updatedAt: String = "",
)

@Serializable
data class LectureDto(
  val id: String,
  val subjectId: String,
  val number: Int? = null,
  val title: String,
  val date: String? = null,
  val summary: String = "",
  val transcript: String = "",
  val createdAt: String = "",
  val updatedAt: String = "",
)

@Serializable
data class AttachmentDto(
  val id: String,
  val originalName: String,
  val mimeType: String,
  val size: Long,
  val subjectId: String? = null,
  val taskId: String? = null,
  val noteId: String? = null,
  val lectureId: String? = null,
  val questionId: String? = null,
  val createdAt: String = "",
)

@Serializable
data class CreateLectureRequest(
  val subjectId: String,
  val title: String,
  val number: Int? = null,
  val date: String? = null,
  val summary: String = "",
  val transcript: String = "",
)

@Serializable
data class UpdateLectureRequest(
  val title: String? = null,
  val number: Int? = null,
  val date: String? = null,
  val summary: String? = null,
  val transcript: String? = null,
)

@Serializable
data class LectureEnvelope(val lecture: LectureDto)

@Serializable
data class AttachmentEnvelope(val attachment: AttachmentDto)

@Serializable
data class BlobPrepareRequest(
  val parentType: String,
  val parentId: String,
  val name: String,
  val size: Long,
)

@Serializable
data class BlobGrantResponse(
  val pathname: String,
  val mimeType: String,
  val clientToken: String,
  val uploadReceipt: String,
)

@Serializable
data class BlobRegisterRequest(val uploadReceipt: String)

@Serializable
data class TranscribeRequest(val attachmentId: String)

@Serializable
data class TranscribeResponse(val transcript: String)

@Serializable
data class CreateNoteRequest(
  val title: String,
  val content: String = "",
  val subjectId: String? = null,
  val color: String = "#fde68a",
  val pinned: Boolean = false,
)

@Serializable
data class UpdateNoteRequest(
  val title: String? = null,
  val content: String? = null,
  val subjectId: String? = null,
  val color: String? = null,
  val pinned: Boolean? = null,
)

@Serializable
data class NoteEnvelope(val note: NoteDto)

@Serializable
data class SyncResponse(
  val serverTime: String,
  val user: MobileUserDto,
  val subjects: List<SubjectDto> = emptyList(),
  val tasks: List<TaskDto> = emptyList(),
  val todayEvents: List<TodayEventDto> = emptyList(),
  val calendarEvents: List<TodayEventDto> = emptyList(),
  val questions: List<QuestionDto> = emptyList(),
  val notes: List<NoteDto> = emptyList(),
  val lectures: List<LectureDto> = emptyList(),
  val attachments: List<AttachmentDto> = emptyList(),
  val stats: SyncStatsDto = SyncStatsDto(),
)

@Serializable
data class CreateTaskRequest(
  val title: String,
  val description: String? = null,
  val subjectId: String? = null,
  val dueDate: String? = null,
  val dueTime: String? = null,
  val priority: String = "MEDIUM",
  val status: String = "PLANNED",
  val kind: String = "TASK",
  val stages: List<String>? = null,
)

@Serializable
data class UpdateTaskRequest(
  val title: String? = null,
  val description: String? = null,
  val subjectId: String? = null,
  val dueDate: String? = null,
  val dueTime: String? = null,
  val priority: String? = null,
  val status: String? = null,
  val kind: String? = null,
)

@Serializable
data class TaskEnvelope(val task: TaskDto)

@Serializable
data class CreateSubtaskRequest(
  val title: String,
  val status: String = "PLANNED",
)

@Serializable
data class UpdateSubtaskRequest(
  val title: String? = null,
  val status: String? = null,
)

@Serializable
data class SubtaskEnvelope(val subtask: SubtaskDto)

@Serializable
data class ApiErrorResponse(val error: String = "Ошибка сервера")

data class PendingOp(
  val id: Long,
  val opType: String,
  val entityId: String,
  val payloadJson: String,
  val createdAt: Long,
)

data class AuthSession(
  val token: String = "",
  val userId: String = "",
  val userName: String = "",
  val userEmail: String = "",
  val lastSyncAt: Long = 0L,
  val doneThisWeek: Int = 0,
  val dueReviewCount: Int = 0,
  val themeMode: String = "system",
  val showLessons: Boolean = false,
  val notifMorningEnabled: Boolean = true,
  val notifMorningHour: Int = 8,
  val notifMorningMinute: Int = 0,
  val notifEveningEnabled: Boolean = true,
  val notifEveningHour: Int = 20,
  val notifEveningMinute: Int = 0,
) {
  val isLoggedIn: Boolean get() = token.isNotBlank()
}

data class StudyHubSnapshot(
  val subjects: List<SubjectDto> = emptyList(),
  val tasks: List<TaskDto> = emptyList(),
  val todayEvents: List<TodayEventDto> = emptyList(),
  val calendarEvents: List<TodayEventDto> = emptyList(),
  val questions: List<QuestionDto> = emptyList(),
  val notes: List<NoteDto> = emptyList(),
  val lectures: List<LectureDto> = emptyList(),
  val attachments: List<AttachmentDto> = emptyList(),
  val pendingOpsCount: Int = 0,
  val isSyncing: Boolean = false,
  val lastError: String? = null,
)
