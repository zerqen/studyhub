package ru.studyhub.app.ui

import android.app.Application
import android.widget.Toast
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.studyhub.app.StudyHubApplication
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.QuickTaskParsed
import ru.studyhub.app.data.StudyHubSnapshot

data class MainUiState(
  val session: AuthSession = AuthSession(),
  val snapshot: StudyHubSnapshot = StudyHubSnapshot(),
  val isAuthLoading: Boolean = false,
  val authError: String? = null,
  val sessionLoaded: Boolean = false,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
  private val repo = (application as StudyHubApplication).repository
  private val authLoading = MutableStateFlow(false)
  private val authError = MutableStateFlow<String?>(null)
  private val _busyAttachmentId = MutableStateFlow<String?>(null)
  val busyAttachmentId: StateFlow<String?> = _busyAttachmentId.asStateFlow()
  private val _uploadingLectureId = MutableStateFlow<String?>(null)
  val uploadingLectureId: StateFlow<String?> = _uploadingLectureId.asStateFlow()
  private val _transcribingAttachmentId = MutableStateFlow<String?>(null)
  val transcribingAttachmentId: StateFlow<String?> = _transcribingAttachmentId.asStateFlow()

  val uiState: StateFlow<MainUiState> = combine(
    repo.sessionStore.sessionFlow,
    repo.snapshot,
    authLoading,
    authError,
  ) { session, snapshot, loading, error ->
    MainUiState(
      session = session,
      snapshot = snapshot,
      isAuthLoading = loading,
      authError = error,
      sessionLoaded = true,
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5_000),
    initialValue = MainUiState(),
  )

  init {
    viewModelScope.launch {
      if (repo.sessionStore.current().isLoggedIn) {
        repo.syncNow()
      }
    }
  }

  fun login(email: String, password: String) {
    if (email.isBlank() || password.isBlank()) {
      authError.value = "Заполни email и пароль"
      return
    }
    viewModelScope.launch {
      authLoading.value = true
      authError.value = null
      val res = repo.login(email, password)
      authLoading.value = false
      res.onFailure { e ->
        authError.value = e.message ?: "Не удалось войти"
      }
    }
  }

  fun logout() {
    viewModelScope.launch { repo.logout() }
  }

  fun syncNow() {
    viewModelScope.launch { repo.syncNow() }
  }

  fun setThemeMode(mode: String) {
    viewModelScope.launch { repo.setThemeMode(mode) }
  }

  fun setShowLessons(show: Boolean) {
    viewModelScope.launch { repo.setShowLessons(show) }
  }

  fun reviewQuestion(questionId: String, grade: Int) {
    viewModelScope.launch { repo.reviewQuestion(questionId, grade) }
  }

  fun createNote(
    title: String,
    content: String,
    subjectId: String?,
    color: String,
    pinned: Boolean,
  ) {
    viewModelScope.launch { repo.createNote(title, content, subjectId, color, pinned) }
  }

  fun updateNote(
    noteId: String,
    title: String,
    content: String,
    subjectId: String?,
    color: String,
    pinned: Boolean,
  ) {
    viewModelScope.launch { repo.updateNote(noteId, title, content, subjectId, color, pinned) }
  }

  fun toggleNotePinned(noteId: String) {
    viewModelScope.launch { repo.toggleNotePinned(noteId) }
  }

  fun deleteNote(noteId: String) {
    viewModelScope.launch { repo.deleteNote(noteId) }
  }

  fun updateNotificationPrefs(
    morningEnabled: Boolean,
    morningHour: Int,
    morningMinute: Int,
    eveningEnabled: Boolean,
    eveningHour: Int,
    eveningMinute: Int,
  ) {
    viewModelScope.launch {
      repo.updateNotificationPrefs(
        morningEnabled,
        morningHour,
        morningMinute,
        eveningEnabled,
        eveningHour,
        eveningMinute,
      )
    }
  }

  fun sendTestNotification() {
    viewModelScope.launch { repo.sendTestNotification() }
  }

  fun toggleTaskDone(taskId: String) {
    viewModelScope.launch { repo.toggleTaskDone(taskId) }
  }

  fun postponeTaskToTomorrow(taskId: String) {
    viewModelScope.launch { repo.postponeTaskToTomorrow(taskId) }
  }

  fun createQuickTask(parsed: QuickTaskParsed) {
    viewModelScope.launch {
      repo.createTask(
        title = parsed.title,
        description = null,
        subjectId = parsed.subjectId,
        dueDate = parsed.dueDateIso,
        dueTime = parsed.dueTime,
        priority = "MEDIUM",
        kind = parsed.kind.wire,
      )
    }
  }

  fun createTask(
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
    stages: List<String>,
  ) {
    viewModelScope.launch {
      repo.createTask(title, description, subjectId, dueDate, dueTime, priority, kind, stages)
    }
  }

  fun updateTask(
    taskId: String,
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
  ) {
    viewModelScope.launch {
      repo.updateTask(taskId, title, description, subjectId, dueDate, dueTime, priority, kind)
    }
  }

  fun deleteTask(taskId: String) {
    viewModelScope.launch { repo.deleteTask(taskId) }
  }

  fun addSubtask(taskId: String, title: String) {
    viewModelScope.launch { repo.addSubtask(taskId, title) }
  }

  fun toggleSubtaskDone(taskId: String, subtaskId: String) {
    viewModelScope.launch { repo.toggleSubtaskDone(taskId, subtaskId) }
  }

  fun deleteSubtask(subtaskId: String) {
    viewModelScope.launch { repo.deleteSubtask(subtaskId) }
  }

  fun createLecture(
    subjectId: String,
    title: String,
    number: Int?,
    date: String?,
    summary: String,
    transcript: String = "",
  ) {
    viewModelScope.launch {
      repo.createLecture(subjectId, title, number, date, summary, transcript)
    }
  }

  fun updateLecture(
    lectureId: String,
    title: String,
    number: Int?,
    date: String?,
    summary: String,
    transcript: String,
  ) {
    viewModelScope.launch {
      repo.updateLecture(lectureId, title, number, date, summary, transcript)
    }
  }

  fun deleteLecture(lectureId: String) {
    viewModelScope.launch { repo.deleteLecture(lectureId) }
  }

  fun isAttachmentCached(attachment: AttachmentDto): Boolean = repo.isAttachmentCached(attachment)

  fun openAttachment(attachment: AttachmentDto, onReady: (File, String) -> Unit) {
    viewModelScope.launch {
      _busyAttachmentId.value = attachment.id
      val res = repo.openOrDownloadAttachment(attachment)
      _busyAttachmentId.value = null
      res.onSuccess { file -> onReady(file, attachment.mimeType) }
      res.onFailure { e ->
        Toast.makeText(getApplication(), e.message ?: "Не удалось открыть файл", Toast.LENGTH_LONG).show()
      }
    }
  }

  fun uploadLectureFile(
    lectureId: String,
    fileName: String,
    mimeType: String,
    bytes: ByteArray,
  ) {
    viewModelScope.launch {
      _uploadingLectureId.value = lectureId
      val res = repo.uploadFileForLecture(lectureId, fileName, mimeType, bytes)
      _uploadingLectureId.value = null
      res.onSuccess {
        Toast.makeText(getApplication(), "Файл «$fileName» загружен", Toast.LENGTH_SHORT).show()
      }
      res.onFailure { e ->
        Toast.makeText(getApplication(), e.message ?: "Ошибка загрузки файла", Toast.LENGTH_LONG).show()
      }
    }
  }

  fun deleteAttachment(attachmentId: String) {
    viewModelScope.launch {
      val res = repo.deleteAttachment(attachmentId)
      res.onFailure { e ->
        Toast.makeText(getApplication(), e.message ?: "Не удалось удалить файл", Toast.LENGTH_LONG).show()
      }
    }
  }

  fun transcribeLectureAudio(lectureId: String, attachmentId: String) {
    viewModelScope.launch {
      _transcribingAttachmentId.value = attachmentId
      val res = repo.transcribeLectureAudio(lectureId, attachmentId)
      _transcribingAttachmentId.value = null
      res.onSuccess {
        Toast.makeText(getApplication(), "Расшифровка готова!", Toast.LENGTH_SHORT).show()
      }
      res.onFailure { e ->
        Toast.makeText(getApplication(), e.message ?: "Ошибка расшифровки", Toast.LENGTH_LONG).show()
      }
    }
  }
}
