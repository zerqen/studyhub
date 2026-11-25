package ru.studyhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Checklist
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Settings
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.LocalDate
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.ui.MainViewModel
import ru.studyhub.app.ui.screens.CalendarScreen
import ru.studyhub.app.ui.screens.CreateTaskSheet
import ru.studyhub.app.ui.screens.HomeScreen
import ru.studyhub.app.ui.screens.LoginScreen
import ru.studyhub.app.ui.screens.ReviewScreen
import ru.studyhub.app.ui.screens.SettingsScreen
import ru.studyhub.app.ui.screens.TaskDetailSheet
import ru.studyhub.app.ui.screens.TasksScreen
import ru.studyhub.app.ui.theme.StudyHubTheme
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private enum class AppTab(val label: String, val icon: ImageVector) {
  HOME("Главная", Icons.Rounded.Home),
  TASKS("Задачи", Icons.Rounded.Checklist),
  CALENDAR("Календарь", Icons.Rounded.CalendarMonth),
  REVIEW("Повтор", Icons.Rounded.School),
  SETTINGS("Настройки", Icons.Rounded.Settings),
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
            initialServerUrl = state.session.serverUrl,
            isLoading = state.isAuthLoading,
            error = state.authError,
            onLogin = vm::login,
          )
        }
        else -> {
          var currentTab by rememberSaveable { mutableStateOf(AppTab.HOME) }
          var showCreateSheet by rememberSaveable { mutableStateOf(false) }
          var createInitialDateIso by rememberSaveable { mutableStateOf<String?>(null) }
          var selectedTaskId by rememberSaveable { mutableStateOf<String?>(null) }

          val selectedTask = selectedTaskId?.let { id ->
            state.snapshot.tasks.firstOrNull { it.id == id }
          }
          val initialCreateDate: LocalDate? = remember(createInitialDateIso) {
            createInitialDateIso?.let { DateHelpers.parseDateOnly(it) } ?: DateHelpers.today().plusDays(1)
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
              if (currentTab == AppTab.HOME || currentTab == AppTab.TASKS || currentTab == AppTab.CALENDAR) {
                FloatingActionButton(
                  onClick = {
                    createInitialDateIso = null
                    showCreateSheet = true
                  },
                  containerColor = colors.accent,
                  contentColor = Color.White,
                ) {
                  Icon(Icons.Rounded.Add, contentDescription = "Добавить задачу")
                }
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
                  onOpenTask = { selectedTaskId = it.id },
                  onOpenCreateTask = {
                    createInitialDateIso = null
                    showCreateSheet = true
                  },
                  onOpenAllTasks = { currentTab = AppTab.TASKS },
                  onOpenReview = { currentTab = AppTab.REVIEW },
                )
                AppTab.TASKS -> TasksScreen(
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
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
                    showCreateSheet = true
                  },
                )
                AppTab.REVIEW -> ReviewScreen(
                  snapshot = state.snapshot,
                  onSync = vm::syncNow,
                  onReviewQuestion = vm::reviewQuestion,
                )
                AppTab.SETTINGS -> SettingsScreen(
                  session = state.session,
                  snapshot = state.snapshot,
                  onSyncNow = vm::syncNow,
                  onThemeChange = vm::setThemeMode,
                  onShowLessonsChange = vm::setShowLessons,
                  onLogout = vm::logout,
                )
              }
            }
          }

          if (showCreateSheet) {
            CreateTaskSheet(
              subjects = state.snapshot.subjects,
              initialDueDate = initialCreateDate,
              onDismiss = { showCreateSheet = false },
              onCreate = vm::createTask,
            )
          }

          if (selectedTask != null) {
            TaskDetailSheet(
              task = selectedTask,
              subjects = state.snapshot.subjects,
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
        }
      }
    }
  }
}
