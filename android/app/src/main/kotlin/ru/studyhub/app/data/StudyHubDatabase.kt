package ru.studyhub.app.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import androidx.core.database.sqlite.transaction

/**
 * Local SQLite database powering full offline mode, SRS flashcards, Calendar,
 * Notes, Lectures, Attachments metadata, local notifications, and the Deadlines widget.
 */
class StudyHubDatabase(context: Context) : SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {
  companion object {
    private const val DB_NAME = "studyhub_offline.db"
    private const val DB_VERSION = 5
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
    createV2Tables(db)
    createV3Tables(db)
    createV4Tables(db)
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) createV2Tables(db)
    if (oldVersion < 3) createV3Tables(db)
    if (oldVersion < 4) {
      runCatching {
        db.execSQL("ALTER TABLE lectures ADD COLUMN transcript TEXT NOT NULL DEFAULT ''")
      }
      createV4Tables(db)
    }
    if (oldVersion < 5) {
      val alterCols = listOf(
        "ALTER TABLE attachments ADD COLUMN folder TEXT NOT NULL DEFAULT 'loose'",
        "ALTER TABLE attachments ADD COLUMN folder_name TEXT NOT NULL DEFAULT 'Не прикреплено'",
        "ALTER TABLE attachments ADD COLUMN folder_color TEXT",
        "ALTER TABLE attachments ADD COLUMN folder_self_study INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE attachments ADD COLUMN where_label TEXT NOT NULL DEFAULT 'Не прикреплено'",
      )
      for (sql in alterCols) {
        runCatching { db.execSQL(sql) }
      }
      db.execSQL("CREATE INDEX IF NOT EXISTS idx_attachments_subject ON attachments(subject_id)")
    }
  }

  private fun createV2Tables(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS calendar_events (
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
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        text TEXT NOT NULL,
        answer TEXT,
        explanation TEXT,
        status TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        kind TEXT NOT NULL,
        ticket_no INTEGER,
        ticket_title TEXT,
        lecture_title TEXT,
        srs_due TEXT,
        srs_interval INTEGER NOT NULL DEFAULT 0,
        srs_ease REAL NOT NULL DEFAULT 2.5,
        srs_reps INTEGER NOT NULL DEFAULT 0,
        srs_lapses INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id)")
  }

  private fun createV3Tables(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        subject_id TEXT,
        color TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id)")
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS lectures (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        number INTEGER,
        title TEXT NOT NULL,
        date TEXT,
        summary TEXT NOT NULL,
        transcript TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_lectures_subject ON lectures(subject_id)")
  }

  private fun createV4Tables(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        subject_id TEXT,
        task_id TEXT,
        note_id TEXT,
        lecture_id TEXT,
        question_id TEXT,
        created_at TEXT NOT NULL,
        folder TEXT NOT NULL DEFAULT 'loose',
        folder_name TEXT NOT NULL DEFAULT 'Не прикреплено',
        folder_color TEXT,
        folder_self_study INTEGER NOT NULL DEFAULT 0,
        where_label TEXT NOT NULL DEFAULT 'Не прикреплено'
      )
      """.trimIndent(),
    )
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_attachments_lecture ON attachments(lecture_id)")
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id)")
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id)")
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_attachments_subject ON attachments(subject_id)")
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

    val events = readEventsTable(db, "today_events")
    val calendarEvents = readEventsTable(db, "calendar_events")

    val questions = mutableListOf<QuestionDto>()
    db.rawQuery(
      """
      SELECT id, subject_id, text, answer, explanation, status, difficulty, kind,
             ticket_no, ticket_title, lecture_title, srs_due, srs_interval,
             srs_ease, srs_reps, srs_lapses, sort_order
      FROM questions
      ORDER BY sort_order ASC
      """.trimIndent(),
      null,
    ).use { c ->
      while (c.moveToNext()) {
        questions += QuestionDto(
          id = c.getString(0),
          subjectId = c.getString(1),
          text = c.getString(2),
          answer = c.getString(3),
          explanation = c.getString(4),
          status = c.getString(5),
          difficulty = c.getString(6),
          kind = c.getString(7),
          ticketNo = if (c.isNull(8)) null else c.getInt(8),
          ticketTitle = c.getString(9),
          lectureTitle = c.getString(10),
          srsDue = c.getString(11),
          srsInterval = c.getInt(12),
          srsEase = c.getDouble(13),
          srsReps = c.getInt(14),
          srsLapses = c.getInt(15),
          sortOrder = c.getInt(16),
        )
      }
    }

    val notes = mutableListOf<NoteDto>()
    db.rawQuery(
      "SELECT id, title, content, subject_id, color, pinned, created_at, updated_at FROM notes ORDER BY pinned DESC, updated_at DESC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        notes += NoteDto(
          id = c.getString(0),
          title = c.getString(1),
          content = c.getString(2),
          subjectId = c.getString(3),
          color = c.getString(4),
          pinned = c.getInt(5) == 1,
          createdAt = c.getString(6),
          updatedAt = c.getString(7),
        )
      }
    }

    val lectures = mutableListOf<LectureDto>()
    db.rawQuery(
      "SELECT id, subject_id, number, title, date, summary, transcript, created_at, updated_at FROM lectures ORDER BY number DESC, date DESC, updated_at DESC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        lectures += LectureDto(
          id = c.getString(0),
          subjectId = c.getString(1),
          number = if (c.isNull(2)) null else c.getInt(2),
          title = c.getString(3),
          date = c.getString(4),
          summary = c.getString(5),
          transcript = c.getString(6),
          createdAt = c.getString(7),
          updatedAt = c.getString(8),
        )
      }
    }

    val attachments = mutableListOf<AttachmentDto>()
    db.rawQuery(
      "SELECT id, original_name, mime_type, size, subject_id, task_id, note_id, lecture_id, question_id, created_at, folder, folder_name, folder_color, folder_self_study, where_label FROM attachments ORDER BY created_at DESC",
      null,
    ).use { c ->
      while (c.moveToNext()) {
        attachments += AttachmentDto(
          id = c.getString(0),
          originalName = c.getString(1),
          mimeType = c.getString(2),
          size = c.getLong(3),
          subjectId = c.getString(4),
          taskId = c.getString(5),
          noteId = c.getString(6),
          lectureId = c.getString(7),
          questionId = c.getString(8),
          createdAt = c.getString(9),
          folder = c.getString(10),
          folderName = c.getString(11),
          folderColor = c.getString(12),
          folderSelfStudy = c.getInt(13) == 1,
          whereLabel = c.getString(14),
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
      calendarEvents = calendarEvents,
      questions = questions,
      notes = notes,
      lectures = lectures,
      attachments = attachments,
      pendingOpsCount = pendingCount,
    )
  }

  private fun readEventsTable(db: SQLiteDatabase, table: String): List<TodayEventDto> {
    val events = mutableListOf<TodayEventDto>()
    db.rawQuery(
      "SELECT event_key, title, kind, kind_label, start_iso, end_iso, all_day, location, color, subject_id, subject_name FROM $table ORDER BY start_iso ASC",
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
    return events
  }

  @Synchronized
  fun replaceServerSnapshot(
    subjects: List<SubjectDto>,
    tasks: List<TaskDto>,
    todayEvents: List<TodayEventDto>,
    calendarEvents: List<TodayEventDto>,
    questions: List<QuestionDto>,
    notes: List<NoteDto>,
    lectures: List<LectureDto>,
    attachments: List<AttachmentDto>,
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

      writeEventsTable(this, "today_events", todayEvents)
      writeEventsTable(this, "calendar_events", calendarEvents)

      delete("questions", null, null)
      for (q in questions) insertQuestionRow(this, q)

      delete("notes", null, null)
      for (n in notes) insertNoteRow(this, n)

      delete("lectures", null, null)
      for (l in lectures) insertLectureRow(this, l)

      delete("attachments", null, null)
      for (a in attachments) insertAttachmentRow(this, a)
    }
  }

  private fun writeEventsTable(db: SQLiteDatabase, table: String, events: List<TodayEventDto>) {
    db.delete(table, null, null)
    for (e in events) {
      db.insert(
        table,
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

  @Synchronized
  fun upsertQuestion(q: QuestionDto) {
    writableDatabase.transaction { insertQuestionRow(this, q) }
  }

  @Synchronized
  fun upsertNote(note: NoteDto) {
    writableDatabase.transaction { insertNoteRow(this, note) }
  }

  @Synchronized
  fun deleteNoteLocal(noteId: String) {
    writableDatabase.delete("notes", "id = ?", arrayOf(noteId))
  }

  @Synchronized
  fun remapNoteId(oldId: String, serverNote: NoteDto) {
    writableDatabase.transaction {
      delete("notes", "id = ?", arrayOf(oldId))
      insertNoteRow(this, serverNote)
      execSQL("UPDATE pending_ops SET entity_id = ? WHERE entity_id = ?", arrayOf(serverNote.id, oldId))
    }
  }

  @Synchronized
  fun upsertLecture(lecture: LectureDto) {
    writableDatabase.transaction { insertLectureRow(this, lecture) }
  }

  @Synchronized
  fun deleteLectureLocal(lectureId: String) {
    writableDatabase.transaction {
      delete("attachments", "lecture_id = ?", arrayOf(lectureId))
      delete("lectures", "id = ?", arrayOf(lectureId))
    }
  }

  @Synchronized
  fun remapLectureId(oldId: String, serverLecture: LectureDto) {
    writableDatabase.transaction {
      delete("lectures", "id = ?", arrayOf(oldId))
      insertLectureRow(this, serverLecture)
      execSQL("UPDATE pending_ops SET entity_id = ? WHERE entity_id = ?", arrayOf(serverLecture.id, oldId))
    }
  }

  @Synchronized
  fun upsertAttachment(a: AttachmentDto) {
    writableDatabase.transaction { insertAttachmentRow(this, a) }
  }

  @Synchronized
  fun deleteAttachmentLocal(attachmentId: String) {
    writableDatabase.delete("attachments", "id = ?", arrayOf(attachmentId))
  }

  @Synchronized
  fun upsertTask(task: TaskDto) {
    writableDatabase.transaction {
      insertTaskRow(this, task)
      delete("subtasks", "task_id = ?", arrayOf(task.id))
      for (st in task.subtasks) insertSubtaskRow(this, st)
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
    writableDatabase.transaction { insertSubtaskRow(this, subtask) }
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
      for (st in serverTask.subtasks) insertSubtaskRow(this, st)
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
      delete("calendar_events", null, null)
      delete("questions", null, null)
      delete("notes", null, null)
      delete("lectures", null, null)
      delete("attachments", null, null)
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

  private fun insertQuestionRow(db: SQLiteDatabase, q: QuestionDto) {
    db.insertWithOnConflict(
      "questions",
      null,
      ContentValues().apply {
        put("id", q.id)
        put("subject_id", q.subjectId)
        put("text", q.text)
        put("answer", q.answer)
        put("explanation", q.explanation)
        put("status", q.status)
        put("difficulty", q.difficulty)
        put("kind", q.kind)
        if (q.ticketNo != null) put("ticket_no", q.ticketNo) else putNull("ticket_no")
        put("ticket_title", q.ticketTitle)
        put("lecture_title", q.lectureTitle)
        put("srs_due", q.srsDue)
        put("srs_interval", q.srsInterval)
        put("srs_ease", q.srsEase)
        put("srs_reps", q.srsReps)
        put("srs_lapses", q.srsLapses)
        put("sort_order", q.sortOrder)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  private fun insertNoteRow(db: SQLiteDatabase, n: NoteDto) {
    db.insertWithOnConflict(
      "notes",
      null,
      ContentValues().apply {
        put("id", n.id)
        put("title", n.title)
        put("content", n.content)
        put("subject_id", n.subjectId)
        put("color", n.color)
        put("pinned", if (n.pinned) 1 else 0)
        put("created_at", n.createdAt)
        put("updated_at", n.updatedAt)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  private fun insertLectureRow(db: SQLiteDatabase, l: LectureDto) {
    db.insertWithOnConflict(
      "lectures",
      null,
      ContentValues().apply {
        put("id", l.id)
        put("subject_id", l.subjectId)
        if (l.number != null) put("number", l.number) else putNull("number")
        put("title", l.title)
        put("date", l.date)
        put("summary", l.summary)
        put("transcript", l.transcript)
        put("created_at", l.createdAt)
        put("updated_at", l.updatedAt)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }

  private fun insertAttachmentRow(db: SQLiteDatabase, a: AttachmentDto) {
    db.insertWithOnConflict(
      "attachments",
      null,
      ContentValues().apply {
        put("id", a.id)
        put("original_name", a.originalName)
        put("mime_type", a.mimeType)
        put("size", a.size)
        put("subject_id", a.subjectId)
        put("task_id", a.taskId)
        put("note_id", a.noteId)
        put("lecture_id", a.lectureId)
        put("question_id", a.questionId)
        put("created_at", a.createdAt)
        put("folder", a.folder)
        put("folder_name", a.folderName)
        put("folder_color", a.folderColor)
        put("folder_self_study", if (a.folderSelfStudy) 1 else 0)
        put("where_label", a.whereLabel)
      },
      SQLiteDatabase.CONFLICT_REPLACE,
    )
  }
}
