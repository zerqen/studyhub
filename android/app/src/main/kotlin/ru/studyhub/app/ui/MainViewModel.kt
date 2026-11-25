package ru.studyhub.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import ru.studyhub.app.StudyHubApplication
import ru.studyhub.app.data.AuthSession
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

  fun login(serverUrl: String, email: String, password: String) {
    if (serverUrl.isBlank() || email.isBlank() || password.isBlank()) {
      authError.value = "Заполни адрес сервера, email и пароль"
      return
    }
    viewModelScope.launch {
      authLoading.value = true
      authError.value = null
      val res = repo.login(serverUrl, email, password)
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

  fun toggleTaskDone(taskId: String) {
    viewModelScope.launch { repo.toggleTaskDone(taskId) }
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
}
