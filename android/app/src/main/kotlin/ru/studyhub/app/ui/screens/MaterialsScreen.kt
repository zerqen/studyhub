package ru.studyhub.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.LectureDto
import ru.studyhub.app.data.MathFormatter
import ru.studyhub.app.data.NoteDto
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.ui.components.MarkdownMathText
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.components.TaskRowItem
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private enum class MaterialsSection(val label: String) {
  SUBJECTS("Предметы"),
  NOTES("Заметки"),
  LECTURES("Лекции"),
}

private enum class SubjectTab(val label: String) {
  LECTURES("Лекции"),
  NOTES("Заметки"),
  TASKS("Задачи"),
  QUESTIONS("Вопросы"),
}

private val NOTE_COLORS = listOf("#fde68a", "#bfdbfe", "#bbf7d0", "#fecdd3", "#e9d5ff", "#fed7aa")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MaterialsScreen(
  snapshot: StudyHubSnapshot,
  selectedSubjectId: String?,
  onSelectSubject: (String?) -> Unit,
  onSync: () -> Unit,
  onOpenSearch: () -> Unit,
  onOpenSettings: () -> Unit,
  onOpenNote: (NoteDto) -> Unit,
  onCreateNote: (subjectId: String?) -> Unit,
  onOpenLecture: (LectureDto) -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
) {
  val selectedSubject = selectedSubjectId?.let { id ->
    snapshot.subjects.firstOrNull { it.id == id }
  }

  if (selectedSubject != null) {
    SubjectDetailView(
      subject = selectedSubject,
      snapshot = snapshot,
      onBack = { onSelectSubject(null) },
      onSync = onSync,
      onOpenNote = onOpenNote,
      onCreateNote = { onCreateNote(selectedSubject.id) },
      onOpenLecture = onOpenLecture,
      onToggleTask = onToggleTask,
      onOpenTask = onOpenTask,
    )
    return
  }

  val colors = StudyHubThemeColors.current
  var section by rememberSaveable { mutableStateOf(MaterialsSection.SUBJECTS) }
  var lectureSubjectFilter by rememberSaveable { mutableStateOf<String?>(null) }
  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }

  PullToRefreshBox(
    isRefreshing = snapshot.isSyncing,
    onRefresh = onSync,
    modifier = Modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = "Конспекты",
            style = MaterialTheme.typography.headlineLarge,
            color = colors.fg,
            modifier = Modifier.weight(1f),
          )
          IconButton(onClick = onOpenSearch) {
            Icon(Icons.Rounded.Search, contentDescription = "Поиск", tint = colors.fg)
          }
          IconButton(onClick = onOpenSettings) {
            Icon(Icons.Rounded.Settings, contentDescription = "Настройки", tint = colors.fg)
          }
          SyncStatusPill(
            isSyncing = snapshot.isSyncing,
            pendingOpsCount = snapshot.pendingOpsCount,
            lastError = snapshot.lastError,
            onSyncClick = onSync,
          )
        }
      }

      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          MaterialsSection.entries.forEach { s ->
            FilterChip(
              selected = section == s,
              onClick = { section = s },
              label = { Text(s.label) },
            )
          }
        }
      }

      when (section) {
        MaterialsSection.SUBJECTS -> {
          if (snapshot.subjects.isEmpty()) {
            item {
              EmptyMaterialsCard(
                title = "Нет предметов",
                hint = "Создай предметы на сайте — они появятся здесь вместе с лекциями и вопросами.",
              )
            }
          } else {
            items(snapshot.subjects, key = { it.id }) { subject ->
              val lectureCount = snapshot.lectures.count { it.subjectId == subject.id }
              val noteCount = snapshot.notes.count { it.subjectId == subject.id }
              val openTaskCount = snapshot.tasks.count {
                it.subjectId == subject.id && it.status != "DONE" && it.status != "CANCELLED"
              }
              SubjectListCard(
                subject = subject,
                lectureCount = lectureCount,
                noteCount = noteCount,
                openTaskCount = openTaskCount,
                onClick = { onSelectSubject(subject.id) },
              )
            }
          }
        }

        MaterialsSection.NOTES -> {
          item {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Text(
                text = "Всего заметок: ${snapshot.notes.size}",
                style = MaterialTheme.typography.labelLarge,
                color = colors.muted,
              )
              FilledTonalButton(
                onClick = { onCreateNote(null) },
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
              ) {
                Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Заметка")
              }
            }
          }

          if (snapshot.notes.isEmpty()) {
            item {
              EmptyMaterialsCard(
                title = "Пока нет заметок",
                hint = "Создай заметку прямо в телефоне — она сохранится оффлайн и уйдёт на сайт.",
              )
            }
          } else {
            items(snapshot.notes, key = { it.id }) { note ->
              NoteListCard(
                note = note,
                subject = note.subjectId?.let { subjectsById[it] },
                onClick = { onOpenNote(note) },
              )
            }
          }
        }

        MaterialsSection.LECTURES -> {
          if (snapshot.subjects.isNotEmpty()) {
            item {
              LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item {
                  FilterChip(
                    selected = lectureSubjectFilter == null,
                    onClick = { lectureSubjectFilter = null },
                    label = { Text("Все предметы") },
                  )
                }
                items(snapshot.subjects, key = { it.id }) { s ->
                  FilterChip(
                    selected = lectureSubjectFilter == s.id,
                    onClick = {
                      lectureSubjectFilter = if (lectureSubjectFilter == s.id) null else s.id
                    },
                    label = { Text("${s.emoji} ${s.name}") },
                  )
                }
              }
            }
          }

          val filteredLectures = snapshot.lectures.filter {
            lectureSubjectFilter == null || it.subjectId == lectureSubjectFilter
          }
          if (filteredLectures.isEmpty()) {
            item {
              EmptyMaterialsCard(
                title = "Лекций пока нет",
                hint = "Конспекты лекций с сайта автоматически загрузятся сюда для чтения оффлайн.",
              )
            }
          } else {
            items(filteredLectures, key = { it.id }) { lecture ->
              LectureListCard(
                lecture = lecture,
                subject = subjectsById[lecture.subjectId],
                onClick = { onOpenLecture(lecture) },
              )
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubjectDetailView(
  subject: SubjectDto,
  snapshot: StudyHubSnapshot,
  onBack: () -> Unit,
  onSync: () -> Unit,
  onOpenNote: (NoteDto) -> Unit,
  onCreateNote: () -> Unit,
  onOpenLecture: (LectureDto) -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val subColor = parseHexColor(subject.color, colors.accent)
  var tab by rememberSaveable(subject.id) { mutableStateOf(SubjectTab.LECTURES) }

  val subjectLectures = remember(snapshot.lectures, subject.id) {
    snapshot.lectures.filter { it.subjectId == subject.id }
  }
  val subjectNotes = remember(snapshot.notes, subject.id) {
    snapshot.notes.filter { it.subjectId == subject.id }
  }
  val subjectTasks = remember(snapshot.tasks, subject.id) {
    snapshot.tasks.filter { it.subjectId == subject.id && it.status != "CANCELLED" }
  }
  val subjectQuestions = remember(snapshot.questions, subject.id) {
    snapshot.questions.filter { it.subjectId == subject.id }
  }

  PullToRefreshBox(
    isRefreshing = snapshot.isSyncing,
    onRefresh = onSync,
    modifier = Modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Назад", tint = colors.fg)
          }
          Box(
            modifier = Modifier
              .size(38.dp)
              .clip(RoundedCornerShape(10.dp))
              .background(subColor.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center,
          ) {
            Text(
              text = DateHelpers.subjectShort(subject.name),
              style = MaterialTheme.typography.labelLarge,
              color = subColor,
              fontWeight = FontWeight.Bold,
            )
          }
          Spacer(modifier = Modifier.width(10.dp))
          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = subject.name,
              style = MaterialTheme.typography.headlineMedium,
              color = colors.fg,
              maxLines = 2,
              overflow = TextOverflow.Ellipsis,
            )
            val examDays = DateHelpers.daysUntil(subject.examDate)
            if (examDays != null && examDays >= 0) {
              Text(
                text = "Экзамен ${DateHelpers.inDaysRu(examDays)} (${DateHelpers.formatShortDate(subject.examDate)})",
                style = MaterialTheme.typography.labelMedium,
                color = if (examDays <= 7) colors.urgent else colors.muted,
              )
            }
          }
        }
      }

      item {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(SubjectTab.entries) { t ->
            val count = when (t) {
              SubjectTab.LECTURES -> subjectLectures.size
              SubjectTab.NOTES -> subjectNotes.size
              SubjectTab.TASKS -> subjectTasks.size
              SubjectTab.QUESTIONS -> subjectQuestions.size
            }
            FilterChip(
              selected = tab == t,
              onClick = { tab = t },
              label = { Text("${t.label} ($count)") },
            )
          }
        }
      }

      when (tab) {
        SubjectTab.LECTURES -> {
          if (subjectLectures.isEmpty()) {
            item { EmptyMaterialsCard("Лекций нет", "Конспекты лекций по предмету появятся после синхронизации.") }
          } else {
            items(subjectLectures, key = { it.id }) { lecture ->
              LectureListCard(lecture = lecture, subject = null, onClick = { onOpenLecture(lecture) })
            }
          }
        }
        SubjectTab.NOTES -> {
          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
              FilledTonalButton(onClick = onCreateNote, shape = RoundedCornerShape(10.dp)) {
                Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Новая заметка")
              }
            }
          }
          if (subjectNotes.isEmpty()) {
            item { EmptyMaterialsCard("Заметок нет", "Нажми «Новая заметка», чтобы записать конспект по предмету.") }
          } else {
            items(subjectNotes, key = { it.id }) { note ->
              NoteListCard(note = note, subject = null, onClick = { onOpenNote(note) })
            }
          }
        }
        SubjectTab.TASKS -> {
          if (subjectTasks.isEmpty()) {
            item { EmptyMaterialsCard("Задач нет", "Все задачи по этому предмету выполнены или отсутствуют.") }
          } else {
            item {
              StudyCard {
                subjectTasks.forEachIndexed { idx, task ->
                  TaskRowItem(
                    task = task,
                    subject = null,
                    onToggleDone = { onToggleTask(task.id) },
                    onClick = { onOpenTask(task) },
                    showDueDate = true,
                  )
                  if (idx < subjectTasks.lastIndex) {
                    HorizontalDivider(color = colors.line.copy(alpha = 0.65f), modifier = Modifier.padding(start = 48.dp))
                  }
                }
              }
            }
          }
        }
        SubjectTab.QUESTIONS -> {
          if (subjectQuestions.isEmpty()) {
            item { EmptyMaterialsCard("Вопросов нет", "Вопросы к экзамену/зачёту появятся здесь после добавления на сайте.") }
          } else {
            items(subjectQuestions, key = { it.id }) { q ->
              ExpandableQuestionCard(question = q)
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }
}

@Composable
private fun SubjectListCard(
  subject: SubjectDto,
  lectureCount: Int,
  noteCount: Int,
  openTaskCount: Int,
  onClick: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val subColor = parseHexColor(subject.color, colors.accent)
  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
          modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(subColor.copy(alpha = 0.14f)),
          contentAlignment = Alignment.Center,
        ) {
          Text(
            text = DateHelpers.subjectShort(subject.name),
            style = MaterialTheme.typography.titleMedium,
            color = subColor,
            fontWeight = FontWeight.Bold,
          )
        }
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = subject.name,
            style = MaterialTheme.typography.titleMedium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
          Text(
            text = "Лекций: $lectureCount · Заметок: $noteCount · Задач: $openTaskCount",
            style = MaterialTheme.typography.labelMedium,
            color = colors.muted,
          )
        }
      }
      if (subject.questionsTotal > 0) {
        LinearProgressIndicator(
          progress = { (subject.questionsLearned.toFloat() / subject.questionsTotal.toFloat()).coerceIn(0f, 1f) },
          modifier = Modifier
            .fillMaxWidth()
            .height(5.dp)
            .clip(RoundedCornerShape(3.dp)),
          color = subColor,
          trackColor = colors.subtle,
        )
      }
    }
  }
}

@Composable
fun NoteListCard(
  note: NoteDto,
  subject: SubjectDto?,
  onClick: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val noteTint = parseHexColor(note.color, Color(0xFFFDE68A))
  val preview = remember(note.content) { MathFormatter.plainPreview(note.content) }

  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
      Box(
        modifier = Modifier
          .padding(top = 4.dp)
          .size(10.dp)
          .clip(CircleShape)
          .background(noteTint),
      )
      Spacer(modifier = Modifier.width(12.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          if (note.pinned) {
            Icon(
              imageVector = Icons.Rounded.PushPin,
              contentDescription = "Закреплена",
              tint = colors.accent,
              modifier = Modifier.size(15.dp),
            )
          }
          Text(
            text = note.title,
            style = MaterialTheme.typography.titleMedium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
          )
        }
        if (preview.isNotBlank()) {
          Text(
            text = preview,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.muted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
          )
        }
        if (subject != null) {
          Text(
            text = "${subject.emoji} ${subject.name}",
            style = MaterialTheme.typography.labelSmall,
            color = parseHexColor(subject.color, colors.accent),
          )
        }
      }
    }
  }
}

@Composable
fun LectureListCard(
  lecture: LectureDto,
  subject: SubjectDto?,
  onClick: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val preview = remember(lecture.summary) { MathFormatter.plainPreview(lecture.summary) }

  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        val label = buildString {
          if (lecture.number != null) append("Лекция ${lecture.number}")
          else append("Лекция")
          if (subject != null) append(" · ${subject.name}")
        }
        Text(
          text = label,
          style = MaterialTheme.typography.labelMedium,
          color = subject?.let { parseHexColor(it.color, colors.accent) } ?: colors.accent,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f),
        )
        if (!lecture.date.isNullOrBlank()) {
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = DateHelpers.formatShortDate(lecture.date),
            style = MaterialTheme.typography.labelSmall,
            color = colors.muted,
          )
        }
      }

      Text(
        text = lecture.title,
        style = MaterialTheme.typography.titleMedium,
        color = colors.fg,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )

      if (preview.isNotBlank()) {
        Text(
          text = preview,
          style = MaterialTheme.typography.bodyMedium,
          color = colors.muted,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
fun ExpandableQuestionCard(question: QuestionDto) {
  val colors = StudyHubThemeColors.current
  var expanded by remember(question.id) { mutableStateOf(false) }

  StudyCard {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .clickable { expanded = !expanded }
        .padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Row(verticalAlignment = Alignment.Top) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          if (question.ticketNo != null) {
            Text(
              text = "Билет №${question.ticketNo}",
              style = MaterialTheme.typography.labelSmall,
              color = colors.accent,
            )
          }
          MarkdownMathText(
            markdown = question.text,
            baseStyle = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
          )
        }
        Icon(
          imageVector = if (expanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,
          contentDescription = null,
          tint = colors.muted,
        )
      }

      if (expanded) {
        HorizontalDivider(color = colors.line)
        if (!question.answer.isNullOrBlank()) {
          MarkdownMathText(markdown = question.answer, baseStyle = MaterialTheme.typography.bodyMedium)
        } else {
          Text("Ответ не заполнен", style = MaterialTheme.typography.bodyMedium, color = colors.muted)
        }
        if (!question.explanation.isNullOrBlank()) {
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(10.dp))
              .background(colors.subtle)
              .padding(10.dp),
          ) {
            MarkdownMathText(
              markdown = question.explanation,
              baseStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.muted),
            )
          }
        }
      }
    }
  }
}

@Composable
private fun EmptyMaterialsCard(title: String, hint: String) {
  val colors = StudyHubThemeColors.current
  StudyCard {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 18.dp, vertical = 26.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      Text(title, style = MaterialTheme.typography.titleMedium, color = colors.fg)
      Text(hint, style = MaterialTheme.typography.bodyMedium, color = colors.muted)
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LectureReaderSheet(
  lecture: LectureDto,
  subject: SubjectDto?,
  onDismiss: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.surface,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      val meta = buildList {
        if (lecture.number != null) add("Лекция ${lecture.number}")
        if (subject != null) add(subject.name)
        if (!lecture.date.isNullOrBlank()) add(DateHelpers.formatShortDate(lecture.date))
      }.joinToString(" · ")

      if (meta.isNotBlank()) {
        Text(meta, style = MaterialTheme.typography.labelLarge, color = colors.accent)
      }
      Text(lecture.title, style = MaterialTheme.typography.headlineMedium, color = colors.fg)
      HorizontalDivider(color = colors.line)

      if (lecture.summary.isBlank()) {
        Text(
          text = "Конспект этой лекции пока пуст.",
          style = MaterialTheme.typography.bodyMedium,
          color = colors.muted,
        )
      } else {
        MarkdownMathText(markdown = lecture.summary, baseStyle = MaterialTheme.typography.bodyLarge)
      }

      Spacer(modifier = Modifier.height(16.dp))
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditorSheet(
  existingNote: NoteDto?,
  subjects: List<SubjectDto>,
  initialSubjectId: String? = null,
  onDismiss: () -> Unit,
  onSave: (title: String, content: String, subjectId: String?, color: String, pinned: Boolean) -> Unit,
  onDelete: (() -> Unit)? = null,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var title by remember(existingNote?.id) { mutableStateOf(existingNote?.title.orEmpty()) }
  var content by remember(existingNote?.id) { mutableStateOf(existingNote?.content.orEmpty()) }
  var subjectId by remember(existingNote?.id, initialSubjectId) {
    mutableStateOf(existingNote?.subjectId ?: initialSubjectId)
  }
  var color by remember(existingNote?.id) { mutableStateOf(existingNote?.color ?: NOTE_COLORS.first()) }
  var pinned by remember(existingNote?.id) { mutableStateOf(existingNote?.pinned ?: false) }
  var previewMode by remember(existingNote?.id) {
    mutableStateOf(existingNote != null && existingNote.content.isNotBlank())
  }
  var confirmDelete by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.surface,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(
          text = if (existingNote == null) "Новая заметка" else "Заметка",
          style = MaterialTheme.typography.headlineMedium,
          color = colors.fg,
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
          FilterChip(
            selected = !previewMode,
            onClick = { previewMode = false },
            label = { Text("Редактор") },
          )
          FilterChip(
            selected = previewMode,
            onClick = { previewMode = true },
            label = { Text("Чтение") },
          )
          if (existingNote != null && onDelete != null) {
            IconButton(onClick = { confirmDelete = true }) {
              Icon(Icons.Rounded.DeleteOutline, contentDescription = "Удалить", tint = colors.danger)
            }
          }
        }
      }

      if (previewMode) {
        Text(
          text = title.ifBlank { "Без названия" },
          style = MaterialTheme.typography.titleLarge,
          color = colors.fg,
        )
        HorizontalDivider(color = colors.line)
        if (content.isBlank()) {
          Text("Текст заметки пуст", style = MaterialTheme.typography.bodyMedium, color = colors.muted)
        } else {
          MarkdownMathText(markdown = content, baseStyle = MaterialTheme.typography.bodyLarge)
        }
      } else {
        OutlinedTextField(
          value = title,
          onValueChange = { title = it },
          label = { Text("Заголовок") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )

        if (subjects.isNotEmpty()) {
          LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
              FilterChip(
                selected = subjectId == null,
                onClick = { subjectId = null },
                label = { Text("Общая") },
              )
            }
            items(subjects, key = { it.id }) { s ->
              FilterChip(
                selected = subjectId == s.id,
                onClick = { subjectId = s.id },
                label = { Text("${s.emoji} ${s.name}") },
              )
            }
          }
        }

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            NOTE_COLORS.forEach { hex ->
              val c = parseHexColor(hex, Color(0xFFFDE68A))
              Box(
                modifier = Modifier
                  .size(26.dp)
                  .clip(CircleShape)
                  .background(c)
                  .border(
                    width = if (color.equals(hex, ignoreCase = true)) 2.dp else 1.dp,
                    color = if (color.equals(hex, ignoreCase = true)) colors.fg else colors.line,
                    shape = CircleShape,
                  )
                  .clickable { color = hex },
              )
            }
          }
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Закрепить", style = MaterialTheme.typography.labelLarge, color = colors.muted)
            Switch(checked = pinned, onCheckedChange = { pinned = it })
          }
        }

        OutlinedTextField(
          value = content,
          onValueChange = { content = it },
          label = { Text("Текст (Markdown и формулы \$...\$)") },
          minLines = 6,
          maxLines = 14,
          modifier = Modifier.fillMaxWidth(),
        )

        Button(
          onClick = {
            onSave(title.trim().ifBlank { "Без названия" }, content, subjectId, color, pinned)
            onDismiss()
          },
          modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
        ) {
          Text("Сохранить заметку", color = Color.White, style = MaterialTheme.typography.titleMedium)
        }
      }

      Spacer(modifier = Modifier.height(14.dp))
    }
  }

  if (confirmDelete && onDelete != null) {
    AlertDialog(
      onDismissRequest = { confirmDelete = false },
      title = { Text("Удалить заметку?") },
      text = { Text("Заметка «${existingNote?.title ?: title}» будет удалена локально и на сервере.") },
      confirmButton = {
        TextButton(
          onClick = {
            confirmDelete = false
            onDelete()
            onDismiss()
          },
        ) {
          Text("Удалить", color = colors.danger)
        }
      },
      dismissButton = {
        TextButton(onClick = { confirmDelete = false }) { Text("Отмена") }
      },
    )
  }
}
