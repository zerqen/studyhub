package ru.studyhub.app.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AudioFile
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ExpandLess
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Functions
import androidx.compose.material.icons.rounded.PictureAsPdf
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
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.FileKind
import ru.studyhub.app.data.FileSort
import ru.studyhub.app.data.FilesViewHelper
import ru.studyhub.app.data.LectureDto
import ru.studyhub.app.data.MathFormatter
import ru.studyhub.app.data.NoteDto
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.ui.components.AttachmentRowItem
import ru.studyhub.app.ui.components.KaTeXMarkdownView
import ru.studyhub.app.ui.components.MarkdownMathText
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.components.TaskRowItem
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.components.readPickedUriBytes
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private enum class MaterialsSection(val label: String) {
  SUBJECTS("Предметы"),
  NOTES("Заметки"),
  LECTURES("Лекции"),
  FILES("Файлы"),
}

private enum class SubjectTab(val label: String) {
  LECTURES("Лекции"),
  NOTES("Заметки"),
  FILES("Файлы"),
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
  onCreateLecture: (subjectId: String?) -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
  busyAttachmentId: String? = null,
  uploadingKey: String? = null,
  isAttachmentCached: (AttachmentDto) -> Boolean = { false },
  onOpenAttachment: (AttachmentDto) -> Unit = {},
  onUploadFile: (parentType: String?, parentId: String?, fileName: String, mimeType: String, bytes: ByteArray, uploadKey: String) -> Unit = { _, _, _, _, _, _ -> },
  onDeleteAttachment: (String) -> Unit = {},
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
      onCreateLecture = { onCreateLecture(selectedSubject.id) },
      onToggleTask = onToggleTask,
      onOpenTask = onOpenTask,
      busyAttachmentId = busyAttachmentId,
      isUploadingSubjectFile = uploadingKey == "subject:${selectedSubject.id}",
      isAttachmentCached = isAttachmentCached,
      onOpenAttachment = onOpenAttachment,
      onUploadSubjectFile = { name, mime, bytes ->
        onUploadFile("subject", selectedSubject.id, name, mime, bytes, "subject:${selectedSubject.id}")
      },
      onDeleteAttachment = onDeleteAttachment,
    )
    return
  }

  val colors = StudyHubThemeColors.current
  val context = LocalContext.current
  var section by rememberSaveable { mutableStateOf(MaterialsSection.SUBJECTS) }
  var lectureSubjectFilter by rememberSaveable { mutableStateOf<String?>(null) }

  var fileFolder by rememberSaveable {
    mutableStateOf(
      if (snapshot.attachments.any { FilesViewHelper.isRecent(it.createdAt) }) "recent" else "all",
    )
  }
  var fileKind by rememberSaveable { mutableStateOf(FileKind.ALL) }
  var fileSort by rememberSaveable { mutableStateOf(FileSort.NEW) }
  var fileQuery by rememberSaveable { mutableStateOf("") }
  var pendingDeleteAttachment by remember { mutableStateOf<AttachmentDto?>(null) }

  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }
  val lecturesById = remember(snapshot.lectures) { snapshot.lectures.associateBy { it.id } }
  val tasksById = remember(snapshot.tasks) { snapshot.tasks.associateBy { it.id } }
  val notesById = remember(snapshot.notes) { snapshot.notes.associateBy { it.id } }

  val allFilePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri != null) {
      readPickedUriBytes(context, uri)?.let { (name, mime, bytes) ->
        val subjectFolder = fileFolder.takeIf { it != "recent" && it != "all" && it != "loose" && fileQuery.isBlank() }
        onUploadFile(
          if (subjectFolder != null) "subject" else null,
          subjectFolder,
          name,
          mime,
          bytes,
          "files:all",
        )
      }
    }
  }

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
        LazyRow(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          items(MaterialsSection.entries) { s ->
            val label = if (s == MaterialsSection.FILES && snapshot.attachments.isNotEmpty()) {
              "${s.label} (${snapshot.attachments.size})"
            } else {
              s.label
            }
            FilterChip(
              selected = section == s,
              onClick = { section = s },
              label = { Text(label) },
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
          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
              FilledTonalButton(
                onClick = { onCreateLecture(lectureSubjectFilter) },
                shape = RoundedCornerShape(10.dp),
              ) {
                Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Новая лекция")
              }
            }
          }

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
                hint = "Нажми «Новая лекция», чтобы создать лекцию и прикрепить PDF или аудио.",
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

        MaterialsSection.FILES -> {
          val folders = FilesViewHelper.buildFolders(snapshot.attachments, snapshot.subjects)
          val recentCount = snapshot.attachments.count { FilesViewHelper.isRecent(it.createdAt) }
          val looseCount = snapshot.attachments.count { it.folder == "loose" }
          val filteredFiles = FilesViewHelper.filterAndSort(
            attachments = snapshot.attachments,
            folderId = fileFolder,
            kind = fileKind,
            sort = fileSort,
            query = fileQuery,
          )
          val activeFolderLabel = when (fileFolder) {
            "recent", "all", "loose" -> "Загрузить"
            else -> "В папку"
          }

          item {
            FilesBrowserControls(
              query = fileQuery,
              onQueryChange = { fileQuery = it },
              selectedFolder = fileFolder,
              onSelectFolder = {
                fileFolder = it
                fileQuery = ""
              },
              recentCount = recentCount,
              totalCount = snapshot.attachments.size,
              looseCount = looseCount,
              folders = folders,
              selectedKind = fileKind,
              onSelectKind = { fileKind = it },
              selectedSort = fileSort,
              onSelectSort = { fileSort = it },
              uploadLabel = activeFolderLabel,
              isUploading = uploadingKey == "files:all",
              onPickUpload = { allFilePicker.launch(arrayOf("*/*")) },
            )
          }

          if (filteredFiles.isEmpty()) {
            item {
              EmptyMaterialsCard(
                title = if (fileQuery.isNotBlank()) "Ничего не нашлось" else "Файлов нет",
                hint = if (snapshot.attachments.isEmpty()) {
                  "Загружай файлы прямо сюда или прикрепляй к предметам, задачам, лекциям и заметкам."
                } else {
                  "В этой папке или с таким фильтром файлов нет."
                },
              )
            }
          } else {
            items(filteredFiles, key = { it.id }) { att ->
              val jumpAction: (() -> Unit)? = when {
                att.lectureId != null && lecturesById[att.lectureId] != null -> {
                  { onOpenLecture(lecturesById.getValue(att.lectureId)) }
                }
                att.taskId != null && tasksById[att.taskId] != null -> {
                  { onOpenTask(tasksById.getValue(att.taskId)) }
                }
                att.noteId != null && notesById[att.noteId] != null -> {
                  { onOpenNote(notesById.getValue(att.noteId)) }
                }
                att.subjectId != null && subjectsById[att.subjectId] != null -> {
                  { onSelectSubject(att.subjectId) }
                }
                else -> null
              }
              FileBrowserRow(
                attachment = att,
                isCached = isAttachmentCached(att),
                isBusy = busyAttachmentId == att.id,
                onOpen = { onOpenAttachment(att) },
                onJumpToSource = jumpAction,
                onDelete = { pendingDeleteAttachment = att },
              )
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }

  pendingDeleteAttachment?.let { target ->
    AlertDialog(
      onDismissRequest = { pendingDeleteAttachment = null },
      title = { Text("Удалить файл?") },
      text = { Text("Файл «${target.originalName}» будет удалён с сервера и из кэша.") },
      confirmButton = {
        TextButton(
          onClick = {
            onDeleteAttachment(target.id)
            pendingDeleteAttachment = null
          },
        ) {
          Text("Удалить", color = colors.danger)
        }
      },
      dismissButton = {
        TextButton(onClick = { pendingDeleteAttachment = null }) { Text("Отмена") }
      },
    )
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
  onCreateLecture: () -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
  busyAttachmentId: String? = null,
  isUploadingSubjectFile: Boolean = false,
  isAttachmentCached: (AttachmentDto) -> Boolean = { false },
  onOpenAttachment: (AttachmentDto) -> Unit = {},
  onUploadSubjectFile: (fileName: String, mimeType: String, bytes: ByteArray) -> Unit = { _, _, _ -> },
  onDeleteAttachment: (String) -> Unit = {},
) {
  val colors = StudyHubThemeColors.current
  val context = LocalContext.current
  val subColor = parseHexColor(subject.color, colors.accent)
  var tab by rememberSaveable(subject.id) { mutableStateOf(SubjectTab.LECTURES) }
  var showFormulaSheet by rememberSaveable(subject.id) { mutableStateOf(false) }
  var pendingDeleteAttachment by remember { mutableStateOf<AttachmentDto?>(null) }

  val subjectLectures = remember(snapshot.lectures, subject.id) {
    snapshot.lectures.filter { it.subjectId == subject.id }
  }
  val subjectNotes = remember(snapshot.notes, subject.id) {
    snapshot.notes.filter { it.subjectId == subject.id }
  }
  val subjectFiles = remember(snapshot.attachments, subject.id) {
    snapshot.attachments.filter { it.folder == subject.id || it.subjectId == subject.id }
  }
  val subjectTasks = remember(snapshot.tasks, subject.id) {
    snapshot.tasks.filter { it.subjectId == subject.id && it.status != "CANCELLED" }
  }
  val subjectQuestions = remember(snapshot.questions, subject.id) {
    snapshot.questions.filter { it.subjectId == subject.id }
  }

  val subjectFilePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri != null) {
      readPickedUriBytes(context, uri)?.let { (name, mime, bytes) ->
        onUploadSubjectFile(name, mime, bytes)
      }
    }
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
          FilledTonalButton(
            onClick = { showFormulaSheet = true },
            shape = RoundedCornerShape(10.dp),
            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
          ) {
            Icon(Icons.Rounded.Functions, contentDescription = "Формулы", modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Формулы")
          }
        }
      }

      item {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(SubjectTab.entries) { t ->
            val count = when (t) {
              SubjectTab.LECTURES -> subjectLectures.size
              SubjectTab.NOTES -> subjectNotes.size
              SubjectTab.FILES -> subjectFiles.size
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
          item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
              FilledTonalButton(onClick = onCreateLecture, shape = RoundedCornerShape(10.dp)) {
                Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Новая лекция")
              }
            }
          }
          if (subjectLectures.isEmpty()) {
            item { EmptyMaterialsCard("Лекций нет", "Нажми «Новая лекция», чтобы добавить лекцию, PDF или аудио.") }
          } else {
            items(subjectLectures, key = { it.id }) { lecture ->
              LectureListCard(lecture = lecture, subject = null, onClick = { onOpenLecture(lecture) })
            }
          }
        }
        SubjectTab.FILES -> {
          item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
              Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                FilledTonalButton(
                  onClick = { subjectFilePicker.launch(arrayOf("*/*")) },
                  enabled = !isUploadingSubjectFile,
                  shape = RoundedCornerShape(10.dp),
                ) {
                  Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                  Spacer(modifier = Modifier.width(4.dp))
                  Text("Загрузить файл")
                }
              }
              if (isUploadingSubjectFile) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = colors.accent)
              }
            }
          }
          if (subjectFiles.isEmpty()) {
            item {
              EmptyMaterialsCard(
                title = "Файлов по предмету нет",
                hint = "Нажми «Загрузить файл», чтобы добавить PDF, методичку или фото к предмету.",
              )
            }
          } else {
            items(subjectFiles, key = { it.id }) { att ->
              FileBrowserRow(
                attachment = att,
                isCached = isAttachmentCached(att),
                isBusy = busyAttachmentId == att.id,
                showFolderBadge = false,
                onOpen = { onOpenAttachment(att) },
                onDelete = { pendingDeleteAttachment = att },
              )
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

  if (showFormulaSheet) {
    FormulaSheetModal(
      subject = subject,
      lectures = subjectLectures,
      questions = subjectQuestions,
      onDismiss = { showFormulaSheet = false },
    )
  }

  pendingDeleteAttachment?.let { target ->
    AlertDialog(
      onDismissRequest = { pendingDeleteAttachment = null },
      title = { Text("Удалить файл?") },
      text = { Text("Файл «${target.originalName}» будет удалён с сервера и из кэша.") },
      confirmButton = {
        TextButton(
          onClick = {
            onDeleteAttachment(target.id)
            pendingDeleteAttachment = null
          },
        ) {
          Text("Удалить", color = colors.danger)
        }
      },
      dismissButton = {
        TextButton(onClick = { pendingDeleteAttachment = null }) { Text("Отмена") }
      },
    )
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
          KaTeXMarkdownView(markdown = question.answer, textSizeSp = 15)
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
            KaTeXMarkdownView(
              markdown = question.explanation,
              textSizeSp = 14,
              mutedText = true,
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

private enum class LectureSheetTab(val label: String) {
  FILES("Файлы"),
  TRANSCRIPT("Расшифровка"),
  SUMMARY("Конспект"),
}

private val TRANSCRIPT_HEADER_RE = Regex("^<!--file:[^|]*\\|(.*)-->\\s*$")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LectureEditorSheet(
  subjects: List<SubjectDto>,
  initialSubjectId: String? = null,
  onDismiss: () -> Unit,
  onCreate: (subjectId: String, title: String, number: Int?, date: String?, summary: String) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var subjectId by remember(subjects, initialSubjectId) {
    mutableStateOf(initialSubjectId ?: subjects.firstOrNull()?.id)
  }
  var title by remember { mutableStateOf("") }
  var numberText by remember { mutableStateOf("") }
  var dateText by remember { mutableStateOf(DateHelpers.today().toString()) }
  var summary by remember { mutableStateOf("") }

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
      Text("Новая лекция", style = MaterialTheme.typography.headlineMedium, color = colors.fg)

      if (subjects.isEmpty()) {
        Text(
          text = "Сначала добавь предмет на сайте и нажми синхронизацию — лекция должна быть привязана к предмету.",
          style = MaterialTheme.typography.bodyMedium,
          color = colors.muted,
        )
      } else {
        Text("Предмет", style = MaterialTheme.typography.labelLarge, color = colors.muted)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(subjects, key = { it.id }) { s ->
            FilterChip(
              selected = subjectId == s.id,
              onClick = { subjectId = s.id },
              label = { Text("${s.emoji} ${s.name}") },
            )
          }
        }

        OutlinedTextField(
          value = title,
          onValueChange = { title = it },
          label = { Text("Название лекции") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          OutlinedTextField(
            value = numberText,
            onValueChange = { if (it.all { ch -> ch.isDigit() } && it.length <= 4) numberText = it },
            label = { Text("№ (опц.)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(0.35f),
          )
          OutlinedTextField(
            value = dateText,
            onValueChange = { if (it.length <= 10) dateText = it },
            label = { Text("Дата (ГГГГ-ММ-ДД)") },
            singleLine = true,
            modifier = Modifier.weight(0.65f),
          )
        }

        OutlinedTextField(
          value = summary,
          onValueChange = { summary = it },
          label = { Text("Конспект (Markdown и формулы)") },
          minLines = 4,
          maxLines = 10,
          modifier = Modifier.fillMaxWidth(),
        )

        Button(
          onClick = {
            val sid = subjectId ?: return@Button
            val cleanDate = dateText.trim().takeIf { DateHelpers.parseDateOnly(it) != null }
            onCreate(sid, title.trim(), numberText.toIntOrNull(), cleanDate, summary)
            onDismiss()
          },
          enabled = subjectId != null && title.isNotBlank(),
          modifier = Modifier
            .fillMaxWidth()
            .height(48.dp),
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
        ) {
          Text("Создать лекцию", color = Color.White, style = MaterialTheme.typography.titleMedium)
        }
      }

      Spacer(modifier = Modifier.height(14.dp))
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LectureReaderSheet(
  lecture: LectureDto,
  subject: SubjectDto?,
  attachments: List<AttachmentDto>,
  busyAttachmentId: String?,
  isUploading: Boolean,
  transcribingAttachmentId: String?,
  isAttachmentCached: (AttachmentDto) -> Boolean,
  onDismiss: () -> Unit,
  onOpenAttachment: (AttachmentDto) -> Unit,
  onUploadFile: (fileName: String, mimeType: String, bytes: ByteArray) -> Unit,
  onDeleteAttachment: (String) -> Unit,
  onTranscribeAudio: (String) -> Unit,
  onSaveEdit: (title: String, number: Int?, date: String?, summary: String, transcript: String) -> Unit,
  onDeleteLecture: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val context = LocalContext.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  var activeTab by rememberSaveable(lecture.id) {
    mutableStateOf(
      when {
        lecture.summary.isNotBlank() -> LectureSheetTab.SUMMARY
        attachments.isNotEmpty() || lecture.transcript.isBlank() -> LectureSheetTab.FILES
        else -> LectureSheetTab.TRANSCRIPT
      },
    )
  }
  var editing by remember(lecture.id) { mutableStateOf(false) }
  var editTitle by remember(lecture.id, lecture.title) { mutableStateOf(lecture.title) }
  var editNumber by remember(lecture.id, lecture.number) { mutableStateOf(lecture.number?.toString().orEmpty()) }
  var editDate by remember(lecture.id, lecture.date) { mutableStateOf(lecture.date?.take(10).orEmpty()) }
  var editSummary by remember(lecture.id, lecture.summary) { mutableStateOf(lecture.summary) }
  var editTranscript by remember(lecture.id, lecture.transcript) { mutableStateOf(lecture.transcript) }
  var confirmDelete by remember { mutableStateOf(false) }

  val docPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri != null) {
      readPickedUriBytes(context, uri)?.let { (name, mime, bytes) ->
        onUploadFile(name, mime, bytes)
      }
    }
  }

  val audioPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri != null) {
      readPickedUriBytes(context, uri)?.let { (name, mime, bytes) ->
        onUploadFile(name, mime, bytes)
      }
    }
  }

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
      val meta = buildList {
        if (lecture.number != null) add("Лекция ${lecture.number}")
        if (subject != null) add(subject.name)
        if (!lecture.date.isNullOrBlank()) add(DateHelpers.formatShortDate(lecture.date))
      }.joinToString(" · ")

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
      ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          if (meta.isNotBlank()) {
            Text(meta, style = MaterialTheme.typography.labelLarge, color = colors.accent)
          }
          Text(lecture.title, style = MaterialTheme.typography.headlineMedium, color = colors.fg)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
          IconButton(onClick = { editing = !editing }) {
            Icon(
              Icons.Rounded.Edit,
              contentDescription = "Редактировать лекцию",
              tint = if (editing) colors.accent else colors.fg,
            )
          }
          IconButton(onClick = { confirmDelete = true }) {
            Icon(Icons.Rounded.DeleteOutline, contentDescription = "Удалить лекцию", tint = colors.danger)
          }
        }
      }

      if (editing) {
        HorizontalDivider(color = colors.line)
        OutlinedTextField(
          value = editTitle,
          onValueChange = { editTitle = it },
          label = { Text("Название") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          OutlinedTextField(
            value = editNumber,
            onValueChange = { if (it.all { ch -> ch.isDigit() } && it.length <= 4) editNumber = it },
            label = { Text("№") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(0.35f),
          )
          OutlinedTextField(
            value = editDate,
            onValueChange = { if (it.length <= 10) editDate = it },
            label = { Text("Дата (ГГГГ-ММ-ДД)") },
            singleLine = true,
            modifier = Modifier.weight(0.65f),
          )
        }
        OutlinedTextField(
          value = editSummary,
          onValueChange = { editSummary = it },
          label = { Text("Конспект (Markdown)") },
          minLines = 5,
          maxLines = 12,
          modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
          value = editTranscript,
          onValueChange = { editTranscript = it },
          label = { Text("Расшифровка") },
          minLines = 4,
          maxLines = 10,
          modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
          OutlinedButton(
            onClick = { editing = false },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(10.dp),
          ) {
            Text("Отмена")
          }
          Button(
            onClick = {
              val cleanDate = editDate.trim().takeIf { DateHelpers.parseDateOnly(it) != null }
              onSaveEdit(
                editTitle.trim().ifBlank { lecture.title },
                editNumber.toIntOrNull(),
                cleanDate,
                editSummary,
                editTranscript,
              )
              editing = false
            },
            modifier = Modifier.weight(1f),
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
          ) {
            Text("Сохранить", color = Color.White)
          }
        }
      } else {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(LectureSheetTab.entries) { tab ->
            val label = when (tab) {
              LectureSheetTab.FILES -> "${tab.label} (${attachments.size})"
              LectureSheetTab.TRANSCRIPT -> if (lecture.transcript.isNotBlank()) "${tab.label} •" else tab.label
              LectureSheetTab.SUMMARY -> tab.label
            }
            FilterChip(
              selected = activeTab == tab,
              onClick = { activeTab = tab },
              label = { Text(label) },
            )
          }
        }
        HorizontalDivider(color = colors.line)

        when (activeTab) {
          LectureSheetTab.FILES -> {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              FilledTonalButton(
                onClick = { docPicker.launch(arrayOf("application/pdf", "image/*", "text/*", "*/*")) },
                enabled = !isUploading,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f),
              ) {
                Icon(Icons.Rounded.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("+ PDF / файл", maxLines = 1, overflow = TextOverflow.Ellipsis)
              }
              OutlinedButton(
                onClick = { audioPicker.launch(arrayOf("audio/*")) },
                enabled = !isUploading,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.weight(1f),
              ) {
                Icon(Icons.Rounded.AudioFile, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("+ Аудио", maxLines = 1, overflow = TextOverflow.Ellipsis)
              }
            }

            if (isUploading) {
              Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = colors.accent)
                Text("Загружаем файл на сервер…", style = MaterialTheme.typography.labelMedium, color = colors.muted)
              }
            }

            if (attachments.isEmpty()) {
              Text(
                text = "Прикрепите PDF, материалы или аудиозапись лекции (до 300 МБ). Аудиофайлы можно автоматически расшифровать через ИИ.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            } else {
              attachments.forEach { att ->
                val isAudio = att.mimeType.startsWith("audio/", ignoreCase = true)
                AttachmentRowItem(
                  attachment = att,
                  isCached = isAttachmentCached(att),
                  isBusy = busyAttachmentId == att.id,
                  isTranscribing = transcribingAttachmentId == att.id,
                  onOpen = { onOpenAttachment(att) },
                  onTranscribe = if (isAudio) ({ onTranscribeAudio(att.id) }) else null,
                  onDelete = { onDeleteAttachment(att.id) },
                )
              }
            }
          }

          LectureSheetTab.TRANSCRIPT -> {
            if (lecture.transcript.isBlank()) {
              Text(
                text = "Расшифровки пока нет. Загрузите аудио во вкладке «Файлы» и нажмите «Расшифровать аудио (ИИ)».",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            } else {
              val lines = remember(lecture.transcript) { lecture.transcript.lines() }
              Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                lines.forEach { line ->
                  val headerMatch = TRANSCRIPT_HEADER_RE.matchEntire(line.trim())
                  when {
                    headerMatch != null -> {
                      Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = colors.subtle,
                      ) {
                        Text(
                          text = headerMatch.groupValues[1],
                          style = MaterialTheme.typography.labelMedium,
                          color = colors.accent,
                          modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                      }
                    }
                    line.isNotBlank() -> {
                      Text(
                        text = line,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.fg,
                      )
                    }
                  }
                }
              }
            }
          }

          LectureSheetTab.SUMMARY -> {
            if (lecture.summary.isBlank()) {
              Text(
                text = "Конспект этой лекции пока пуст. Нажми карандаш вверху, чтобы добавить текст.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            } else {
              KaTeXMarkdownView(markdown = lecture.summary, textSizeSp = 15)
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(16.dp))
    }
  }

  if (confirmDelete) {
    AlertDialog(
      onDismissRequest = { confirmDelete = false },
      title = { Text("Удалить лекцию?") },
      text = { Text("Лекция «${lecture.title}» и её прикреплённые файлы будут удалены.") },
      confirmButton = {
        TextButton(
          onClick = {
            confirmDelete = false
            onDeleteLecture()
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditorSheet(
  existingNote: NoteDto?,
  subjects: List<SubjectDto>,
  initialSubjectId: String? = null,
  attachments: List<AttachmentDto> = emptyList(),
  busyAttachmentId: String? = null,
  isUploading: Boolean = false,
  isAttachmentCached: (AttachmentDto) -> Boolean = { false },
  onOpenAttachment: (AttachmentDto) -> Unit = {},
  onUploadFile: ((fileName: String, mimeType: String, bytes: ByteArray) -> Unit)? = null,
  onDeleteAttachment: ((String) -> Unit)? = null,
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
          KaTeXMarkdownView(markdown = content, textSizeSp = 15)
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

      if (attachments.isNotEmpty() || (existingNote != null && onUploadFile != null)) {
        val noteContext = LocalContext.current
        val noteFilePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
          if (uri != null && onUploadFile != null) {
            readPickedUriBytes(noteContext, uri)?.let { (name, mime, bytes) ->
              onUploadFile(name, mime, bytes)
            }
          }
        }
        HorizontalDivider(color = colors.line)
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text("Вложения (${attachments.size})", style = MaterialTheme.typography.titleMedium, color = colors.fg)
          if (existingNote != null && onUploadFile != null) {
            FilledTonalButton(
              onClick = { noteFilePicker.launch(arrayOf("*/*")) },
              enabled = !isUploading,
              shape = RoundedCornerShape(10.dp),
            ) {
              Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(4.dp))
              Text("Файл")
            }
          }
        }
        if (isUploading) {
          LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = colors.accent)
        }
        attachments.forEach { att ->
          AttachmentRowItem(
            attachment = att,
            isCached = isAttachmentCached(att),
            isBusy = busyAttachmentId == att.id,
            onOpen = { onOpenAttachment(att) },
            onDelete = if (onDeleteAttachment != null) ({ onDeleteAttachment(att.id) }) else null,
          )
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
