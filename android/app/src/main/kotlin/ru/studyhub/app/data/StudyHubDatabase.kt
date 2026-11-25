package ru.studyhub.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.core.database.sqlite.transaction

/**
 * Local SQLite database powering full offline mode and the home-screen Deadlines widget.
 */
class StudyHubDatabase(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
  companion object {
    private const val DB_NAME = "studyhub_offline.db"
    private const val DB_VERSION = 1
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        type TEXT NOT NULL,
        exam_date TEXT,
        questions_total INTEGER NOT NULL DEFAULT 0,
        questions_learned INTEGER NOT NULL DEFAULT 0,
        progress INTEGER NOT NULL DEFAULT 0
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        subject_id TEXT,
        start_date TEXT,
        due_date TEXT,
        due_time TEXT,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        kind TEXT NOT NULL,
        lesson_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE subtasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        parent_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        due_date TEXT,
        note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX idx_subtasks_task ON subtasks(task_id)")
    db.execSQL(
      """
      CREATE TABLE today_events (
        event_key TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        kind_label TEXT NOT NULL,
        start_iso TEXT NOT NULL,
        end_iso TEXT,
        all_day INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        color TEXT NOT NULL,
        subject_id TEXT,
        subject_name TEXT
      )
      """.trimIndent(),
    )
    db.execSQL(
      """
      CREATE TABLE pending_ops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
      """.trimIndent(),
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    db.execSQL("DROP TABLE IF EXISTS subjects")
    db.execSQL("DROP TABLE IF EXISTS tasks")
    db.execSQL("DROP TABLE IF EXISTS subtasks")
    db.execSQL("DROP TABLE IF EXISTS today_events")
    db.execSQL("DROP TABLE IF EXISTS pending_ops")
    onCreate(db)
  }

  @Synchronized
  fun readSnapshot(): StudyHubSnapshot {
    val db = readableDatabase
    val subjects = mutableListOf<SubjectDto>()
    db.rawQuery(
      "SELECT id, name, emoji, color, type, exam_date, questions_total, questions_learned, progress FROM subjects",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        subjects += SubjectDto(
          id = c.getString(0),
          name = c.getString(1),
          emoji = c.getString(2),
          color = c.getString(3),
          type = c.getString(4),
          examDate = c.getString(5),
          questionsTotal = c.getInt(6),
          questionsLearned = c.getInt(7),
          progress = c.getInt(8),
        )
      }
    }

    val subtasksByTask = mutableMapOf<String, MutableList<SubtaskDto>>()
    db.rawQuery(
      "SELECT id, task_id, parent_id, title, status, due_date, note, sort_order, updated_at FROM subtasks ORDER BY sort_order ASC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        val st = SubtaskDto(
          id = c.getString(0),
          taskId = c.getString(1),
          parentId = c.getString(2),
          title = c.getString(3),
          status = c.getString(4),
          dueDate = c.getString(5),
          note = c.getString(6),
          sortOrder = c.getInt(7),
          updatedAt = c.getString(8),
        )
        subtasksByTask.getOrPut(st.taskId) { mutableListOf() }.add(st)
      }
    }

    val tasks = mutableListOf<TaskDto>()
    db.rawQuery(
      "SELECT id, title, description, subject_id, start_date, due_date, due_time, priority, status, kind, lesson_at, created_at, updated_at FROM tasks",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        val id = c.getString(0)
        tasks += TaskDto(
          id = id,
          title = c.getString(1),
          description = c.getString(2),
          subjectId = c.getString(3),
          startDate = c.getString(4),
          dueDate = c.getString(5),
          dueTime = c.getString(6),
          priority = c.getString(7),
          status = c.getString(8),
          kind = c.getString(9),
          lessonAt = c.getString(10),
          createdAt = c.getString(11),
          updatedAt = c.getString(12),
          subtasks = subtasksByTask[id].orEmpty(),
        )
      }
    }

    val events = mutableListOf<TodayEventDto>()
    db.rawQuery(
      "SELECT event_key, title, kind, kind_label, start_iso, end_iso, all_day, location, color, subject_id, subject_name FROM today_events ORDER BY start_iso ASC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        events += TodayEventDto(
          key = c.getString(0),
          title = c.getString(1),
          kind = c.getString(2),
          kindLabel = c.getString(3),
          start = c.getString(4),
          end = c.getString(5),
          allDay = c.getInt(6) == 1,
          location = c.getString(7),
          color = c.getString(8),
          subjectId = c.getString(9),
          subjectName = c.getString(10),
        )
      }
    }

    var pendingCount = 0
    db.rawQuery("SELECT COUNT(*) FROM pending_ops", null).use { c ->
      if (c.moveToFirst()) pendingCount = c.getInt(0)
    }

    return StudyHubSnapshot(
      subjects = subjects,
      tasks = tasks,
      todayEvents = events,
      pendingOpsCount = pendingCount,
    )
  }

  @Synchronized
  fun replaceServerSnapshot(
    subjects: List<SubjectDto>,
    tasks: List<TaskDto>,
    todayEvents: List<TodayEventDto>,
  ) {
    writableDatabase.transaction {
      delete("subjects", null, null)
      for (s in subjects) {
        insert(
          "subjects",
          null,
          ContentValues().apply {
            put("id", s.id)
            put("name", s.name)
            put("emoji", s.emoji)
            put("color", s.color)
            put("type", s.type)
            put("exam_date", s.examDate)
            put("questions_total", s.questionsTotal)
            put("questions_learned", s.questionsLearned)
            put("progress", s.progress)
          },
        )
      }

      delete("subtasks", null, null)
      delete("tasks", null, null)
      for (t in tasks) {
        insertTaskRow(this, t)
        for (st in t.subtasks) {
          insertSubtaskRow(this, st)
        }
      }

      delete("today_events", null, null)
      for (e in todayEvents) {
        insert(
          "today_events",
          null,
          ContentValues().apply {
            put("event_key", e.key)
            put("title", e.title)
            put("kind", e.kind)
            put("kind_label", e.kindLabel)
            put("start_iso", e.start)
            put("end_iso", e.end)
            put("all_day", if (e.allDay) 1 else 0)
            put("location", e.location)
            put("color", e.color)
            put("subject_id", e.subjectId)
            put("subject_name", e.subjectName)
          },
        )
      }
    }
  }

  @Synchronized
  fun upsertTask(task: TaskDto) {
    writableDatabase.transaction {
      insertTaskRow(this, task)
      delete("subtasks", "task_id = ?", arrayOf(task.id))
      for (st in task.subtasks) {
        insertSubtaskRow(this, st)
      }
    }
  }

  @Synchronized
  fun deleteTaskLocal(taskId: String) {
    writableDatabase.transaction {
      delete("subtasks", "task_id = ?", arrayOf(taskId))
      delete("tasks", "id = ?", arrayOf(taskId))
    }
  }

  @Synchronized
  fun upsertSubtask(subtask: SubtaskDto) {
    writableDatabase.transaction {
      insertSubtaskRow(this, subtask)
    }
  }

  @Synchronized
  fun deleteSubtaskLocal(subtaskId: String) {
    writableDatabase.delete("subtasks", "id = ?", arrayOf(subtaskId))
  }

  @Synchronized
  fun enqueueOp(opType: String, entityId: String, payloadJson: String) {
    writableDatabase.insert(
      "pending_ops",
      null,
      ContentValues().apply {
        put("op_type", opType)
        put("entity_id", entityId)
        put("payload_json", payloadJson)
        put("created_at", System.currentTimeMillis())
      },
    )
  }

  @Synchronized
  fun getPendingOps(): List<PendingOp> {
    val list = mutableListOf<PendingOp>()
    readableDatabase.rawQuery(
      "SELECT id, op_type, entity_id, payload_json, created_at FROM pending_ops ORDER BY id ASC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        list += PendingOp(
          id = c.getLong(0),
          opType = c.getString(1),
          entityId = c.getString(2),
          payloadJson = c.getString(3),
          createdAt = c.getLong(4),
        )
      }
    }
    return list
  }

  @Synchronized
  fun removePendingOp(opId: Long) {
    writableDatabase.delete("pending_ops", "id = ?", arrayOf(opId.toString()))
  }

  @Synchronized
  fun remapTaskId(oldId: String, serverTask: TaskDto) {
    writableDatabase.transaction {
      delete("subtasks", "task_id = ?", arrayOf(oldId))
      delete("tasks", "id = ?", arrayOf(oldId))
      insertTaskRow(this, serverTask)
      for (st in serverTask.subtasks) {
        insertSubtaskRow(this, st)
      }
      execSQL("UPDATE pending_ops SET entity_id = ? WHERE entity_id = ?", arrayOf(serverTask.id, oldId))
    }
  }

  @Synchronized
  fun remapSubtaskId(oldId: String, serverSubtask: SubtaskDto) {
    writableDatabase.transaction {
      delete("subtasks", "id = ?", arrayOf(oldId))
      insertSubtaskRow(this, serverSubtask)
      execSQL("UPDATE pending_ops SET entity_id = ? WHERE entity_id = ?", arrayOf(serverSubtask.id, oldId))
    }
  }

  @Synchronized
  fun clearAll() {
    writableDatabase.transaction {
      delete("subjects", null, null)
      delete("tasks", null, null)
      delete("subtasks", null, null)
      delete("today_events", null, null)
      delete("pending_ops", null, null)
    }
  }

  private fun insertTaskRow(db: SQLiteDatabase, t: TaskDto) {
    db.insertWithOnConflict(
      "tasks",
      null,
      ContentValues().apply {
        put("id", t.id)
        put("title", t.title)
        put("description", t.description)
        put("subject_id", t.subjectId)
        put("start_date", t.startDate)
        put("due_date", t.dueDate)
        put("due_time", t.dueTime)
        put("priority", t.priority)
        put("status", t.status)
        put("kind", t.kind)
        put("lesson_at", t.lessonAt)
        put("created_at", t.createdAt)
        put("updated_at", t.updatedAt)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  private fun insertSubtaskRow(db: SQLiteDatabase, st: SubtaskDto) {
    db.insertWithOnConflict(
      "subtasks",
      null,
      ContentValues().apply {
        put("id", st.id)
        put("task_id", st.taskId)
        put("parent_id", st.parentId)
        put("title", st.title)
        put("status", st.status)
        put("due_date", st.dueDate)
        put("note", st.note)
        put("sort_order", st.sortOrder)
        put("updated_at", st.updatedAt)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }
}
