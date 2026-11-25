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
data class SyncResponse(
  val serverTime: String,
  val user: MobileUserDto,
  val subjects: List<SubjectDto> = emptyList(),
  val tasks: List<TaskDto> = emptyList(),
  val todayEvents: List<TodayEventDto> = emptyList(),
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
  val serverUrl: String = "",
  val token: String = "",
  val userId: String = "",
  val userName: String = "",
  val userEmail: String = "",
  val lastSyncAt: Long = 0L,
  val doneThisWeek: Int = 0,
  val dueReviewCount: Int = 0,
  val themeMode: String = "system",
) {
  val isLoggedIn: Boolean get() = token.isNotBlank() && serverUrl.isNotBlank()
}

data class StudyHubSnapshot(
  val subjects: List<SubjectDto> = emptyList(),
  val tasks: List<TaskDto> = emptyList(),
  val todayEvents: List<TodayEventDto> = emptyList(),
  val pendingOpsCount: Int = 0,
  val isSyncing: Boolean = false,
  val lastError: String? = null,
)
