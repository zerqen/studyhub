package ru.studyhub.app.data

import android.content.Context
import java.io.IOException
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import ru.studyhub.app.widget.DeadlinesWidgetUpdater

@Serializable
private data class CreateSubtaskOpPayload(
  val taskId: String,
  val title: String,
)

class StudyHubRepository(
  private val context: Context,
  val sessionStore: SessionStore,
  private val db: StudyHubDatabase,
  private val api: StudyHubApi,
) {
  companion object {
    const val OP_CREATE_TASK = "CREATE_TASK"
    const val OP_UPDATE_TASK = "UPDATE_TASK"
    const val OP_DELETE_TASK = "DELETE_TASK"
    const val OP_CREATE_SUBTASK = "CREATE_SUBTASK"
    const val OP_UPDATE_SUBTASK = "UPDATE_SUBTASK"
    const val OP_DELETE_SUBTASK = "DELETE_SUBTASK"
    const val OP_REVIEW_QUESTION = "REVIEW_QUESTION"
  }

  private val syncMutex = Mutex()
  private val _snapshot = MutableStateFlow(db.readSnapshot())
  val snapshot: StateFlow<StudyHubSnapshot> = _snapshot.asStateFlow()

  private fun refreshFromDb(error: String? = null) {
    val current = db.readSnapshot()
    _snapshot.update { prev ->
      current.copy(isSyncing = prev.isSyncing, lastError = error)
    }
  }

  private suspend fun notifyWidgets() {
    runCatching { DeadlinesWidgetUpdater.updateAll(context) }
  }

  suspend fun login(serverUrl: String, email: String, password: String): Result<Unit> = runCatching {
    val normalized = normalizeUrl(serverUrl)
    val res = api.login(normalized, email, password)
    sessionStore.saveLogin(normalized, res.token, res.user)
    syncNow()
    SyncWorker.schedulePeriodic(context)
  }

  suspend fun logout() {
    withContext(Dispatchers.IO) {
      db.clearAll()
    }
    sessionStore.clearAuth()
    refreshFromDb(error = null)
    notifyWidgets()
  }

  suspend fun setThemeMode(mode: String) {
    sessionStore.setThemeMode(mode)
  }

  suspend fun setShowLessons(show: Boolean) {
    sessionStore.setShowLessons(show)
  }

  suspend fun syncNow(): Result<Unit> = syncMutex.withLock {
    val session = sessionStore.current()
    if (!session.isLoggedIn) return Result.success(Unit)

    _snapshot.update { it.copy(isSyncing = true, lastError = null) }
    try {
      // 1. Flush pending offline operations in FIFO order
      val ops = withContext(Dispatchers.IO) { db.getPendingOps() }
      for (op in ops) {
        try {
          processOp(session, op)
          withContext(Dispatchers.IO) { db.removePendingOp(op.id) }
        } catch (e: ApiException) {
          if (e.statusCode == 401 || e.statusCode == 403) {
            throw e
          }
          if (e.statusCode == 404 && (op.opType == OP_DELETE_TASK || op.opType == OP_DELETE_SUBTASK)) {
            withContext(Dispatchers.IO) { db.removePendingOp(op.id) }
          } else if (e.statusCode in 400..499) {
            // Drop invalid client op so queue doesn't block forever
            withContext(Dispatchers.IO) { db.removePendingOp(op.id) }
          } else {
            throw e
          }
        }
      }

      // 2. Pull fresh snapshot from server
      val remote = api.sync(session.serverUrl, session.token)
      withContext(Dispatchers.IO) {
        db.replaceServerSnapshot(
          subjects = remote.subjects,
          tasks = remote.tasks,
          todayEvents = remote.todayEvents,
          calendarEvents = remote.calendarEvents,
          questions = remote.questions,
        )
      }
      sessionStore.updateSyncMeta(remote.user, remote.stats, System.currentTimeMillis())
      _snapshot.value = withContext(Dispatchers.IO) { db.readSnapshot() }.copy(isSyncing = false, lastError = null)
      notifyWidgets()
      Result.success(Unit)
    } catch (e: ApiException) {
      val msg = if (e.statusCode == 401) "Сессия истекла — войдите снова" else e.message ?: "Ошибка синхронизации"
      _snapshot.update { it.copy(isSyncing = false, lastError = msg) }
      Result.failure(e)
    } catch (e: IOException) {
      _snapshot.update { it.copy(isSyncing = false, lastError = "Оффлайн — изменения сохранены локально") }
      SyncWorker.enqueueOneShot(context)
      Result.failure(e)
    } catch (e: Exception) {
      _snapshot.update { it.copy(isSyncing = false, lastError = e.message ?: "Ошибка синхронизации") }
      Result.failure(e)
    }
  }

  private suspend fun processOp(session: AuthSession, op: PendingOp) {
    when (op.opType) {
      OP_CREATE_TASK -> {
        val req = api.json.decodeFromString<CreateTaskRequest>(op.payloadJson)
        val created = api.createTask(session.serverUrl, session.token, req)
        withContext(Dispatchers.IO) { db.remapTaskId(op.entityId, created) }
      }
      OP_UPDATE_TASK -> {
        if (op.entityId.startsWith("local_")) return
        val req = api.json.decodeFromString<UpdateTaskRequest>(op.payloadJson)
        val updated = api.updateTask(session.serverUrl, session.token, op.entityId, req)
        withContext(Dispatchers.IO) { db.upsertTask(updated) }
      }
      OP_DELETE_TASK -> {
        if (op.entityId.startsWith("local_")) return
        api.deleteTask(session.serverUrl, session.token, op.entityId)
      }
      OP_CREATE_SUBTASK -> {
        val payload = api.json.decodeFromString<CreateSubtaskOpPayload>(op.payloadJson)
        if (payload.taskId.startsWith("local_")) return
        val created = api.createSubtask(
          session.serverUrl,
          session.token,
          payload.taskId,
          CreateSubtaskRequest(title = payload.title),
        )
        withContext(Dispatchers.IO) { db.remapSubtaskId(op.entityId, created) }
      }
      OP_UPDATE_SUBTASK -> {
        if (op.entityId.startsWith("local_")) return
        val req = api.json.decodeFromString<UpdateSubtaskRequest>(op.payloadJson)
        val updated = api.updateSubtask(session.serverUrl, session.token, op.entityId, req)
        withContext(Dispatchers.IO) { db.upsertSubtask(updated) }
      }
      OP_DELETE_SUBTASK -> {
        if (op.entityId.startsWith("local_")) return
        api.deleteSubtask(session.serverUrl, session.token, op.entityId)
      }
      OP_REVIEW_QUESTION -> {
        val req = api.json.decodeFromString<ReviewRequest>(op.payloadJson)
        api.reviewQuestion(session.serverUrl, session.token, req.questionId, req.grade)
      }
    }
  }

  suspend fun toggleTaskDone(taskId: String) {
    val existing = _snapshot.value.tasks.firstOrNull { it.id == taskId } ?: return
    val nextStatus = if (existing.status == "DONE") "PLANNED" else "DONE"
    val nowIso = Instant.now().toString()
    val updated = existing.copy(status = nextStatus, updatedAt = nowIso)
    withContext(Dispatchers.IO) {
      db.upsertTask(updated)
      db.enqueueOp(
        OP_UPDATE_TASK,
        taskId,
        api.json.encodeToString(UpdateTaskRequest(status = nextStatus)),
      )
    }
    refreshFromDb()
    notifyWidgets()
    syncNow()
  }

  suspend fun createTask(
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
    stages: List<String> = emptyList(),
  ) {
    val cleanTitle = title.trim()
    if (cleanTitle.isBlank()) return
    val nowIso = Instant.now().toString()
    val localId = "local_${UUID.randomUUID()}"
    val localSubtasks = stages.mapIndexed { idx, s ->
      SubtaskDto(
        id = "local_st_${UUID.randomUUID()}",
        taskId = localId,
        title = s,
        status = "PLANNED",
        sortOrder = idx + 1,
        updatedAt = nowIso,
      )
    }
    val localTask = TaskDto(
      id = localId,
      title = cleanTitle,
      description = description?.trim()?.ifBlank { null },
      subjectId = subjectId?.ifBlank { null },
      dueDate = dueDate,
      dueTime = dueTime?.trim()?.ifBlank { null },
      priority = priority,
      status = "PLANNED",
      kind = kind,
      createdAt = nowIso,
      updatedAt = nowIso,
      subtasks = localSubtasks,
    )
    val req = CreateTaskRequest(
      title = localTask.title,
      description = localTask.description,
      subjectId = localTask.subjectId,
      dueDate = localTask.dueDate,
      dueTime = localTask.dueTime,
      priority = localTask.priority,
      status = localTask.status,
      kind = localTask.kind,
      stages = stages.ifEmpty { null },
    )
    withContext(Dispatchers.IO) {
      db.upsertTask(localTask)
      db.enqueueOp(OP_CREATE_TASK, localId, api.json.encodeToString(req))
    }
    refreshFromDb()
    notifyWidgets()
    syncNow()
  }

  suspend fun updateTask(
    taskId: String,
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
  ) {
    val existing = _snapshot.value.tasks.firstOrNull { it.id == taskId } ?: return
    val cleanTitle = title.trim()
    if (cleanTitle.isBlank()) return
    val nowIso = Instant.now().toString()
    val updated = existing.copy(
      title = cleanTitle,
      description = description?.trim()?.ifBlank { null },
      subjectId = subjectId?.ifBlank { null },
      dueDate = dueDate,
      dueTime = dueTime?.trim()?.ifBlank { null },
      priority = priority,
      kind = kind,
      updatedAt = nowIso,
    )
    val req = UpdateTaskRequest(
      title = updated.title,
      description = updated.description ?: "",
      subjectId = updated.subjectId ?: "",
      dueDate = updated.dueDate,
      dueTime = updated.dueTime ?: "",
      priority = updated.priority,
      kind = updated.kind,
    )
    withContext(Dispatchers.IO) {
      db.upsertTask(updated)
      db.enqueueOp(OP_UPDATE_TASK, taskId, api.json.encodeToString(req))
    }
    refreshFromDb()
    notifyWidgets()
    syncNow()
  }

  suspend fun deleteTask(taskId: String) {
    withContext(Dispatchers.IO) {
      db.deleteTaskLocal(taskId)
      db.enqueueOp(OP_DELETE_TASK, taskId, "{}")
    }
    refreshFromDb()
    notifyWidgets()
    syncNow()
  }

  suspend fun addSubtask(taskId: String, title: String) {
    val cleanTitle = title.trim()
    if (cleanTitle.isBlank()) return
    val task = _snapshot.value.tasks.firstOrNull { it.id == taskId } ?: return
    val nowIso = Instant.now().toString()
    val localId = "local_st_${UUID.randomUUID()}"
    val sub = SubtaskDto(
      id = localId,
      taskId = taskId,
      title = cleanTitle,
      status = "PLANNED",
      sortOrder = (task.subtasks.maxOfOrNull { it.sortOrder } ?: 0) + 1,
      updatedAt = nowIso,
    )
    withContext(Dispatchers.IO) {
      db.upsertSubtask(sub)
      db.enqueueOp(
        OP_CREATE_SUBTASK,
        localId,
        api.json.encodeToString(CreateSubtaskOpPayload(taskId = taskId, title = cleanTitle)),
      )
    }
    refreshFromDb()
    syncNow()
  }

  suspend fun toggleSubtaskDone(taskId: String, subtaskId: String) {
    val task = _snapshot.value.tasks.firstOrNull { it.id == taskId } ?: return
    val sub = task.subtasks.firstOrNull { it.id == subtaskId } ?: return
    val nextStatus = if (sub.status == "DONE") "PLANNED" else "DONE"
    val updated = sub.copy(status = nextStatus, updatedAt = Instant.now().toString())
    withContext(Dispatchers.IO) {
      db.upsertSubtask(updated)
      db.enqueueOp(
        OP_UPDATE_SUBTASK,
        subtaskId,
        api.json.encodeToString(UpdateSubtaskRequest(status = nextStatus)),
      )
    }
    refreshFromDb()
    syncNow()
  }

  suspend fun deleteSubtask(subtaskId: String) {
    withContext(Dispatchers.IO) {
      db.deleteSubtaskLocal(subtaskId)
      db.enqueueOp(OP_DELETE_SUBTASK, subtaskId, "{}")
    }
    refreshFromDb()
    syncNow()
  }

  suspend fun reviewQuestion(questionId: String, grade: Int) {
    val existing = _snapshot.value.questions.firstOrNull { it.id == questionId } ?: return
    val clampedGrade = grade.coerceIn(0, 3)
    val prev = SrsState(
      interval = existing.srsInterval,
      ease = existing.srsEase,
      reps = existing.srsReps,
      lapses = existing.srsLapses,
    )
    val next = SrsEngine.schedule(prev, clampedGrade)
    val due = SrsEngine.dueDate(next)
    val nextStatus = SrsEngine.statusFor(next, clampedGrade)
    val updated = existing.copy(
      status = nextStatus,
      srsDue = due.toString(),
      srsInterval = next.interval,
      srsEase = next.ease,
      srsReps = next.reps,
      srsLapses = next.lapses,
    )
    withContext(Dispatchers.IO) {
      db.upsertQuestion(updated)
      db.enqueueOp(
        OP_REVIEW_QUESTION,
        questionId,
        api.json.encodeToString(ReviewRequest(questionId, clampedGrade)),
      )
    }
    refreshFromDb()
    syncNow()
  }

  private fun normalizeUrl(raw: String): String {
    val trimmed = raw.trim().trimEnd('/')
    return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      trimmed
    } else {
      "https://$trimmed"
    }
  }
}
