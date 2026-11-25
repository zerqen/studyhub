package ru.studyhub.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.QuickTaskParsed
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.ui.components.QuickAddTaskBar
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SwipeableTaskRow
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private enum class TaskFilter(val label: String) {
  OPEN("Открытые"),
  HOMEWORK("ДЗ"),
  OVERDUE("Просрочено"),
  TODAY("Сегодня"),
  DONE("Сделано"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(
  snapshot: StudyHubSnapshot,
  onSync: () -> Unit,
  onToggleTask: (String) -> Unit,
  onPostponeTask: (String) -> Unit,
  onQuickCreateTask: (QuickTaskParsed) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  var filter by rememberSaveable { mutableStateOf(TaskFilter.OPEN) }
  var selectedSubjectId by rememberSaveable { mutableStateOf<String?>(null) }
  var query by rememberSaveable { mutableStateOf("") }

  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }
  val today = remember { DateHelpers.today() }

  val filtered = remember(snapshot.tasks, filter, selectedSubjectId, query, today) {
    val q = query.trim().lowercase()
    snapshot.tasks
      .filter { task ->
        val matchesFilter = when (filter) {
          TaskFilter.OPEN -> task.status != "DONE" && task.status != "CANCELLED"
          TaskFilter.HOMEWORK -> task.kind == "HOMEWORK" && task.status != "DONE" && task.status != "CANCELLED"
          TaskFilter.OVERDUE -> DateHelpers.isOverdue(task, today)
          TaskFilter.TODAY -> {
            task.status != "DONE" && task.status != "CANCELLED" && DateHelpers.parseDateOnly(task.dueDate) == today
          }
          TaskFilter.DONE -> task.status == "DONE"
        }
        val matchesSubject = selectedSubjectId == null || task.subjectId == selectedSubjectId
        val matchesQuery = q.isEmpty() ||
          task.title.lowercase().contains(q) ||
          (task.description?.lowercase()?.contains(q) == true) ||
          (task.subjectId?.let { subjectsById[it]?.name?.lowercase()?.contains(q) } == true)
        matchesFilter && matchesSubject && matchesQuery
      }
      .sortedWith(
        if (filter == TaskFilter.DONE) {
          compareByDescending<TaskDto> { it.updatedAt }
        } else {
          compareBy<TaskDto>(
            { DateHelpers.parseDateOnly(it.dueDate) == null },
            { DateHelpers.parseDateOnly(it.dueDate) ?: LocalDate.MAX },
            { it.dueTime ?: "99:99" },
          )
        },
      )
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
            text = "Задачи и ДЗ",
            style = MaterialTheme.typography.headlineLarge,
            color = colors.fg,
          )
          SyncStatusPill(
            isSyncing = snapshot.isSyncing,
            pendingOpsCount = snapshot.pendingOpsCount,
            lastError = snapshot.lastError,
            onSyncClick = onSync,
          )
        }
      }

      item {
        QuickAddTaskBar(
          subjects = snapshot.subjects,
          onQuickCreate = onQuickCreateTask,
        )
      }

      item {
        OutlinedTextField(
          value = query,
          onValueChange = { query = it },
          placeholder = { Text("Поиск по задачам и предметам…") },
          singleLine = true,
          shape = RoundedCornerShape(14.dp),
          leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
          trailingIcon = {
            if (query.isNotEmpty()) {
              IconButton(onClick = { query = "" }) {
                Icon(Icons.Rounded.Close, contentDescription = "Очистить")
              }
            }
          },
          modifier = Modifier.fillMaxWidth(),
        )
      }

      // Main filter chips
      item {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(TaskFilter.entries) { f ->
            FilterChip(
              selected = filter == f,
              onClick = { filter = f },
              label = { Text(f.label) },
            )
          }
        }
      }

      // Subject filter chips
      if (snapshot.subjects.isNotEmpty()) {
        item {
          LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
              FilterChip(
                selected = selectedSubjectId == null,
                onClick = { selectedSubjectId = null },
                label = { Text("Все предметы") },
              )
            }
            items(snapshot.subjects, key = { it.id }) { sub ->
              FilterChip(
                selected = selectedSubjectId == sub.id,
                onClick = {
                  selectedSubjectId = if (selectedSubjectId == sub.id) null else sub.id
                },
                label = { Text("${sub.emoji} ${sub.name}") },
              )
            }
          }
        }
      }

      // Task list card
      if (filtered.isEmpty()) {
        item {
          StudyCard {
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 28.dp),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
              Text(
                text = "Ничего не найдено",
                style = MaterialTheme.typography.titleMedium,
                color = colors.fg,
              )
              Text(
                text = "Попробуй сменить фильтр или добавь новую задачу кнопкой «+»",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            }
          }
        }
      } else {
        item {
          StudyCard {
            filtered.forEachIndexed { idx, task ->
              SwipeableTaskRow(
                task = task,
                subject = task.subjectId?.let { subjectsById[it] },
                onToggleDone = { onToggleTask(task.id) },
                onPostponeTomorrow = { onPostponeTask(task.id) },
                onClick = { onOpenTask(task) },
                showDueDate = true,
              )
              if (idx < filtered.lastIndex) {
                HorizontalDivider(
                  color = colors.line.copy(alpha = 0.65f),
                  modifier = Modifier.padding(start = 48.dp),
                )
              }
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }
}
