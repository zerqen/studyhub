package ru.studyhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Checklist
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.LocalDate
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.ui.MainViewModel
import ru.studyhub.app.ui.components.openFileWithSystemViewer
import ru.studyhub.app.ui.screens.CalendarScreen
import ru.studyhub.app.ui.screens.CreateTaskSheet
import ru.studyhub.app.ui.screens.GlobalSearchSheet
import ru.studyhub.app.ui.screens.HomeScreen
import ru.studyhub.app.ui.screens.LectureEditorSheet
import ru.studyhub.app.ui.screens.LectureReaderSheet
import ru.studyhub.app.ui.screens.LoginScreen
import ru.studyhub.app.ui.screens.MaterialsScreen
import ru.studyhub.app.ui.screens.NoteEditorSheet
import ru.studyhub.app.ui.screens.ReviewScreen
import ru.studyhub.app.ui.screens.SettingsScreen
import ru.studyhub.app.ui.screens.TaskDetailSheet
import ru.studyhub.app.ui.screens.TasksScreen
import ru.studyhub.app.ui.theme.StudyHubTheme
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private enum class AppTab(val label: String, val icon: ImageVector) {
  HOME("Главная", Icons.Rounded.Home),
  TASKS("Задачи", Icons.Rounded.Checklist),
  MATERIALS("Конспекты", Icons.AutoMirrored.Rounded.MenuBook),
  CALENDAR("Календарь", Icons.Rounded.CalendarMonth),
  REVIEW("Повтор", Icons.Rounded.School),
}

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      StudyHubRoot()
    }
  }
}

@Composable
private fun StudyHubRoot(vm: MainViewModel = viewModel()) {
  val state by vm.uiState.collectAsStateWithLifecycle()
  val busyAttachmentId by vm.busyAttachmentId.collectAsStateWithLifecycle()
  val uploadingLectureId by vm.uploadingLectureId.collectAsStateWithLifecycle()
  val transcribingAttachmentId by vm.transcribingAttachmentId.collectAsStateWithLifecycle()
  val context = LocalContext.current
  val openAttachment: (AttachmentDto) -> Unit = { att ->
    vm.openAttachment(att) { file, mime ->
      openFileWithSystemViewer(context, file, mime)
    }
  }

  StudyHubTheme(themeMode = state.session.themeMode) {
    val colors = StudyHubThemeColors.current
    Surface(
      modifier = Modifier.fillMaxSize(),
      color = MaterialTheme.colorScheme.background,
    ) {
      when {
        !state.sessionLoaded -> {
          Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = colors.accent)
          }
        }
        !state.session.isLoggedIn -> {
          LoginScreen(
            isLoading = state.isAuthLoading,
            error = state.authError,
            onLogin = vm::login,
          )
        }
        else -> {
          var currentTab by rememberSaveable { mutableStateOf(AppTab.HOME) }
          var showSettings by rememberSaveable { mutableStateOf(false) }
          var showGlobalSearch by rememberSaveable { mutableStateOf(false) }
          var selectedSubjectId by rememberSaveable { mutableStateOf<String?>(null) }

          var showCreateTaskSheet by rememberSaveable { mutableStateOf(false) }
          var createInitialDateIso by rememberSaveable { mutableStateOf<String?>(null) }
          var selectedTaskId by rememberSaveable { mutableStateOf<String?>(null) }

          var showCreateNoteSheet by rememberSaveable { mutableStateOf(false) }
          var createNoteSubjectId by rememberSaveable { mutableStateOf<String?>(null) }
          var editingNoteId by rememberSaveable { mutableStateOf<String?>(null) }
          var showCreateLectureSheet by rememberSaveable { mutableStateOf(false) }
          var createLectureSubjectId by rememberSaveable { mutableStateOf<String?>(null) }
          var readingLectureId by rememberSaveable { mutableStateOf<String?>(null) }

          val selectedTask = selectedTaskId?.let { id ->
            state.snapshot.tasks.firstOrNull { it.id == id }
          }
          val editingNote = editingNoteId?.let { id ->
            state.snapshot.notes.firstOrNull { it.id == id }
          }
          val readingLecture = readingLectureId?.let { id ->
            state.snapshot.lectures.firstOrNull { it.id == id }
          }
          val initialCreateDate: LocalDate? = remember(createInitialDateIso) {
            createInitialDateIso?.let { DateHelpers.parseDateOnly(it) } ?: DateHelpers.today().plusDays(1)
          }

          if (showSettings) {
            BackHandler { showSettings = false }
            SettingsScreen(
              session = state.session,
              snapshot = state.snapshot,
              onBack = { showSettings = false },
              onSyncNow = vm::syncNow,
              onThemeChange = vm::setThemeMode,
              onShowLessonsChange = vm::setShowLessons,
              onUpdateNotifications = vm::updateNotificationPrefs,
              onTestNotification = vm::sendTestNotification,
              onLogout = {
                showSettings = false
                vm.logout()
              },
            )
            return@Surface
          }

          if (currentTab == AppTab.MATERIALS && selectedSubjectId != null) {
            BackHandler { selectedSubjectId = null }
          }

          Scaffold(
            containerColor = colors.bg,
            bottomBar = {
              NavigationBar(containerColor = colors.surface) {
                AppTab.entries.forEach { tab ->
                  NavigationBarItem(
                    selected = currentTab == tab,
                    onClick = { currentTab = tab },
                    icon = { Icon(tab.icon, contentDescription = tab.label) },
                    label = { Text(tab.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                  )
                }
              }
            },
            floatingActionButton = {
              when (currentTab) {
                AppTab.HOME, AppTab.TASKS, AppTab.CALENDAR -> {
                  FloatingActionButton(
                    onClick = {
                      createInitialDateIso = null
                      showCreateTaskSheet = true
                    },
                    containerColor = colors.accent,
                    contentColor = Color.White,
                  ) {
                    Icon(Icons.Rounded.Add, contentDescription = "Добавить задачу")
                  }
                }
                AppTab.MATERIALS -> {
                  FloatingActionButton(
                    onClick = {
                      createNoteSubjectId = selectedSubjectId
                      editingNoteId = null
                      showCreateNoteSheet = true
                    },
                    containerColor = colors.accent,
                    contentColor = Color.White,
                  ) {
                    Icon(Icons.Rounded.Add, contentDescription = "Добавить заметку")
                  }
                }
                AppTab.REVIEW -> Unit
              }
            },
          ) { innerPadding ->
            Box(
              modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            ) {
              when (currentTab) {
                AppTab.HOME -> HomeScreen(
                  session = state.session,
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
                  onToggleTask = vm::toggleTaskDone,
                  onPostponeTask = vm::postponeTaskToTomorrow,
                  onQuickCreateTask = vm::createQuickTask,
                  onOpenTask = { selectedTaskId = it.id },
                  onOpenCreateTask = {
                    createInitialDateIso = null
                    showCreateTaskSheet = true
                  },
                  onOpenAllTasks = { currentTab = AppTab.TASKS },
                  onOpenReview = { currentTab = AppTab.REVIEW },
                  onOpenSearch = { showGlobalSearch = true },
                  onOpenSettings = { showSettings = true },
                  onOpenSubject = { subjectId ->
                    selectedSubjectId = subjectId
                    currentTab = AppTab.MATERIALS
                  },
                )
                AppTab.TASKS -> TasksScreen(
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
                  onToggleTask = vm::toggleTaskDone,
                  onPostponeTask = vm::postponeTaskToTomorrow,
                  onQuickCreateTask = vm::createQuickTask,
                  onOpenTask = { selectedTaskId = it.id },
                )
                AppTab.MATERIALS -> MaterialsScreen(
                  snapshot = state.snapshot,
                  selectedSubjectId = selectedSubjectId,
                  onSelectSubject = { selectedSubjectId = it },
                  onSync = vm::syncNow,
                  onOpenSearch = { showGlobalSearch = true },
                  onOpenSettings = { showSettings = true },
                  onOpenNote = { editingNoteId = it.id },
                  onCreateNote = { subjId ->
                    createNoteSubjectId = subjId
                    editingNoteId = null
                    showCreateNoteSheet = true
                  },
                  onOpenLecture = { readingLectureId = it.id },
                  onCreateLecture = { subjId ->
                    createLectureSubjectId = subjId
                    showCreateLectureSheet = true
                  },
                  onToggleTask = vm::toggleTaskDone,
                  onOpenTask = { selectedTaskId = it.id },
                )
                AppTab.CALENDAR -> CalendarScreen(
                  session = state.session,
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
                  onToggleShowLessons = vm::setShowLessons,
                  onToggleTask = vm::toggleTaskDone,
                  onOpenTask = { selectedTaskId = it.id },
                  onCreateTaskOnDate = { date ->
                    createInitialDateIso = date.toString()
                    showCreateTaskSheet = true
                  },
                )
                AppTab.REVIEW -> ReviewScreen(
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
                  onReviewQuestion = vm::reviewQuestion,
                )
              }
            }
          }

          if (showCreateTaskSheet) {
            CreateTaskSheet(
              subjects = state.snapshot.subjects,
              initialDueDate = initialCreateDate,
              onDismiss = { showCreateTaskSheet = false },
              onCreate = vm::createTask,
            )
          }

          if (selectedTask != null) {
            val taskAttachments = state.snapshot.attachments.filter { it.taskId == selectedTask.id }
            TaskDetailSheet(
              task = selectedTask,
              subjects = state.snapshot.subjects,
              attachments = taskAttachments,
              busyAttachmentId = busyAttachmentId,
              isAttachmentCached = vm::isAttachmentCached,
              onOpenAttachment = openAttachment,
              onDismiss = { selectedTaskId = null },
              onToggleDone = { vm.toggleTaskDone(selectedTask.id) },
              onSaveEdits = { title, desc, subj, due, time, prio, kind ->
                vm.updateTask(selectedTask.id, title, desc, subj, due, time, prio, kind)
              },
              onDelete = { vm.deleteTask(selectedTask.id) },
              onAddSubtask = { vm.addSubtask(selectedTask.id, it) },
              onToggleSubtask = { vm.toggleSubtaskDone(selectedTask.id, it) },
              onDeleteSubtask = { vm.deleteSubtask(it) },
            )
          }

          if (showCreateNoteSheet) {
            NoteEditorSheet(
              existingNote = null,
              subjects = state.snapshot.subjects,
              initialSubjectId = createNoteSubjectId,
              onDismiss = { showCreateNoteSheet = false },
              onSave = { title, content, subjectId, color, pinned ->
                vm.createNote(title, content, subjectId, color, pinned)
              },
            )
          }

          if (editingNote != null) {
            val noteAttachments = state.snapshot.attachments.filter { it.noteId == editingNote.id }
            NoteEditorSheet(
              existingNote = editingNote,
              subjects = state.snapshot.subjects,
              attachments = noteAttachments,
              busyAttachmentId = busyAttachmentId,
              isAttachmentCached = vm::isAttachmentCached,
              onOpenAttachment = openAttachment,
              onDismiss = { editingNoteId = null },
              onSave = { title, content, subjectId, color, pinned ->
                vm.updateNote(editingNote.id, title, content, subjectId, color, pinned)
              },
              onDelete = { vm.deleteNote(editingNote.id) },
            )
          }

          if (showCreateLectureSheet) {
            LectureEditorSheet(
              subjects = state.snapshot.subjects,
              initialSubjectId = createLectureSubjectId,
              onDismiss = { showCreateLectureSheet = false },
              onCreate = vm::createLecture,
            )
          }

          if (readingLecture != null) {
            val subject = state.snapshot.subjects.firstOrNull { it.id == readingLecture.subjectId }
            val lectureAttachments = state.snapshot.attachments.filter { it.lectureId == readingLecture.id }
            LectureReaderSheet(
              lecture = readingLecture,
              subject = subject,
              attachments = lectureAttachments,
              busyAttachmentId = busyAttachmentId,
              isUploading = uploadingLectureId == readingLecture.id,
              transcribingAttachmentId = transcribingAttachmentId,
              isAttachmentCached = vm::isAttachmentCached,
              onDismiss = { readingLectureId = null },
              onOpenAttachment = openAttachment,
              onUploadFile = { name, mime, bytes ->
                vm.uploadLectureFile(readingLecture.id, name, mime, bytes)
              },
              onDeleteAttachment = vm::deleteAttachment,
              onTranscribeAudio = { attId ->
                vm.transcribeLectureAudio(readingLecture.id, attId)
              },
              onSaveEdit = { title, number, date, summary, transcript ->
                vm.updateLecture(readingLecture.id, title, number, date, summary, transcript)
              },
              onDeleteLecture = { vm.deleteLecture(readingLecture.id) },
            )
          }

          if (showGlobalSearch) {
            GlobalSearchSheet(
              snapshot = state.snapshot,
              onDismiss = { showGlobalSearch = false },
              onOpenSubject = { subjectId ->
                selectedSubjectId = subjectId
                currentTab = AppTab.MATERIALS
              },
              onToggleTask = vm::toggleTaskDone,
              onOpenTask = { selectedTaskId = it.id },
              onOpenNote = { editingNoteId = it.id },
              onOpenLecture = { readingLectureId = it.id },
            )
          }
        }
      }
    }
  }
}
