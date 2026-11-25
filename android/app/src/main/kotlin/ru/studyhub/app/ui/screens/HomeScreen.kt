package ru.studyhub.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TaskKind
import ru.studyhub.app.data.TodayEventDto
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.components.TaskRowItem
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
  session: AuthSession,
  snapshot: StudyHubSnapshot,
  onSync: () -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
  onOpenCreateTask: () -> Unit,
  onOpenAllTasks: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }
  val weekGroups = remember(snapshot.tasks) { DateHelpers.buildWeekGroups(snapshot.tasks) }
  val weekCount = remember(weekGroups) { weekGroups.sumOf { it.items.size } }
  val exams = remember(snapshot.subjects) {
    snapshot.subjects
      .filter { it.examDate != null && (DateHelpers.daysUntil(it.examDate) ?: -1L) >= 0L }
      .sortedBy { DateHelpers.parseDateOnly(it.examDate) }
  }
  val firstName = session.userName.trim().substringBefore(" ").ifBlank { "Студент" }

  PullToRefreshBox(
    isRefreshing = snapshot.isSyncing,
    onRefresh = onSync,
    modifier = Modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      // Greeting header
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.Top,
        ) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
              text = DateHelpers.todayLineRu(),
              style = MaterialTheme.typography.bodyMedium,
              color = colors.muted,
            )
            Text(
              text = "${DateHelpers.greetingRu()}, $firstName",
              style = MaterialTheme.typography.headlineLarge,
              color = colors.fg,
            )
          }
          Spacer(modifier = Modifier.width(8.dp))
          SyncStatusPill(
            isSyncing = snapshot.isSyncing,
            pendingOpsCount = snapshot.pendingOpsCount,
            lastError = snapshot.lastError,
            onSyncClick = onSync,
          )
        }
      }

      // Error/offline notice if any
      if (!snapshot.lastError.isNullOrBlank()) {
        item {
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(12.dp))
              .background(colors.urgentSoft)
              .padding(horizontal = 14.dp, vertical = 10.dp),
          ) {
            Text(
              text = snapshot.lastError,
              style = MaterialTheme.typography.bodyMedium,
              color = colors.urgent,
            )
          }
        }
      }

      // Main card: This Week
      item {
        StudyCard {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(start = 16.dp, end = 12.dp, top = 14.dp, bottom = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Column {
              Text(
                text = "На этой неделе",
                style = MaterialTheme.typography.headlineMedium,
                color = colors.fg,
              )
              Text(
                text = "$weekCount открытых · ${session.doneThisWeek} сделано",
                style = MaterialTheme.typography.labelMedium,
                color = colors.muted,
              )
            }
            FilledTonalButton(
              onClick = onOpenCreateTask,
              contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
              shape = RoundedCornerShape(10.dp),
            ) {
              Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(4.dp))
              Text("Задача", style = MaterialTheme.typography.labelLarge)
            }
          }

          if (weekGroups.isEmpty()) {
            HorizontalDivider(color = colors.line)
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 24.dp),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              Text(
                text = "На неделю дел нет",
                style = MaterialTheme.typography.titleMedium,
                color = colors.fg,
              )
              Text(
                text = "Добавь домашку или задачу — она сразу появится здесь и в виджете",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            }
          } else {
            weekGroups.forEach { group ->
              HorizontalDivider(color = colors.line)
              Row(
                modifier = Modifier
                  .fillMaxWidth()
                  .background(if (group.urgent) colors.urgentSoft.copy(alpha = 0.45f) else colors.subtle.copy(alpha = 0.6f))
                  .padding(horizontal = 14.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
              ) {
                Text(
                  text = group.label,
                  style = MaterialTheme.typography.labelLarge,
                  color = if (group.urgent) colors.urgent else colors.fg,
                )
                if (group.dateLabel.isNotBlank()) {
                  Text(
                    text = group.dateLabel,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (group.urgent) colors.urgent else colors.muted,
                  )
                }
              }

              group.items.forEachIndexed { idx, task ->
                TaskRowItem(
                  task = task,
                  subject = task.subjectId?.let { subjectsById[it] },
                  onToggleDone = { onToggleTask(task.id) },
                  onClick = { onOpenTask(task) },
                  showDueDate = group.key == "overdue",
                )
                if (idx < group.items.lastIndex) {
                  HorizontalDivider(
                    color = colors.line.copy(alpha = 0.65f),
                    modifier = Modifier.padding(start = 48.dp),
                  )
                }
              }
            }
          }
        }
      }

      // Today's lessons (if any cached)
      if (snapshot.todayEvents.isNotEmpty()) {
        item {
          TodayLessonsCard(events = snapshot.todayEvents)
        }
      }

      // Upcoming exams countdown
      if (exams.isNotEmpty()) {
        item {
          SessionExamsCard(exams = exams)
        }
      }

      // Subjects strip
      if (snapshot.subjects.isNotEmpty()) {
        item {
          Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.Bottom,
            ) {
              Text(
                text = "Предметы",
                style = MaterialTheme.typography.headlineMedium,
                color = colors.fg,
              )
              FilledTonalButton(
                onClick = onOpenAllTasks,
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                shape = RoundedCornerShape(8.dp),
              ) {
                Text("Все задачи →", style = MaterialTheme.typography.labelMedium)
              }
            }

            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
              items(snapshot.subjects, key = { it.id }) { subject ->
                SubjectTile(subject = subject, tasks = snapshot.tasks)
              }
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(72.dp)) }
    }
  }
}

@Composable
private fun TodayLessonsCard(events: List<TodayEventDto>) {
  val colors = StudyHubThemeColors.current
  StudyCard {
    Text(
      text = "Сегодня по расписанию",
      style = MaterialTheme.typography.titleLarge,
      color = colors.fg,
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
    )
    events.forEachIndexed { idx, ev ->
      HorizontalDivider(color = colors.line)
      val stripeColor = parseHexColor(ev.color, colors.accent)
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Box(
          modifier = Modifier
            .width(4.dp)
            .height(34.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(stripeColor),
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = ev.title,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
          val meta = listOfNotNull(
            ev.kindLabel.takeIf { it.isNotBlank() },
            ev.location?.takeIf { it.isNotBlank() },
          ).joinToString(" · ")
          if (meta.isNotBlank()) {
            Text(
              text = meta,
              style = MaterialTheme.typography.labelMedium,
              color = colors.muted,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )
          }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Text(
          text = if (ev.allDay) "Весь день" else DateHelpers.formatEventTime(ev.start),
          style = MaterialTheme.typography.labelLarge,
          color = colors.fg,
        )
      }
      if (idx == events.lastIndex) {
        Spacer(modifier = Modifier.height(2.dp))
      }
    }
  }
}

@Composable
private fun SessionExamsCard(exams: List<SubjectDto>) {
  val colors = StudyHubThemeColors.current
  val firstDays = DateHelpers.daysUntil(exams.firstOrNull()?.examDate)
  StudyCard {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text("Сессия", style = MaterialTheme.typography.titleLarge, color = colors.fg)
      if (firstDays != null) {
        Text(
          text = DateHelpers.inDaysRu(firstDays),
          style = MaterialTheme.typography.labelLarge,
          color = colors.urgent,
        )
      }
    }

    exams.take(5).forEach { exam ->
      HorizontalDivider(color = colors.line)
      val progress = if (exam.questionsTotal > 0) {
        exam.questionsLearned.toFloat() / exam.questionsTotal.toFloat()
      } else {
        0f
      }
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
        ) {
          Text(
            text = exam.name,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
          )
          Spacer(modifier = Modifier.width(8.dp))
          Text(
            text = DateHelpers.formatShortDate(exam.examDate),
            style = MaterialTheme.typography.labelLarge,
            color = colors.fg,
          )
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          LinearProgressIndicator(
            progress = { progress.coerceIn(0f, 1f) },
            modifier = Modifier
              .weight(1f)
              .height(6.dp)
              .clip(RoundedCornerShape(3.dp)),
            color = colors.accent,
            trackColor = colors.subtle,
          )
          Text(
            text = if (exam.questionsTotal > 0) "${exam.questionsLearned}/${exam.questionsTotal}" else "нет вопр.",
            style = MaterialTheme.typography.labelSmall,
            color = colors.muted,
          )
        }
      }
    }
  }
}

@Composable
private fun SubjectTile(subject: SubjectDto, tasks: List<TaskDto>) {
  val colors = StudyHubThemeColors.current
  val subColor = parseHexColor(subject.color, colors.accent)
  val nearest = remember(tasks, subject.id) {
    tasks
      .filter { it.subjectId == subject.id && it.status != "DONE" && it.status != "CANCELLED" && it.dueDate != null }
      .minByOrNull { DateHelpers.parseDateOnly(it.dueDate) ?: java.time.LocalDate.MAX }
  }
  val subtitle = remember(nearest, subject) {
    if (nearest != null) {
      val kind = TaskKind.fromWire(nearest.kind)
      val what = if (kind == TaskKind.TASK) nearest.title else kind.shortLabel
      val (whenText, urgent) = DateHelpers.formatDueShort(nearest.dueDate)
      "$what — $whenText" to urgent
    } else if (subject.examDate != null) {
      "экзамен ${DateHelpers.formatShortDate(subject.examDate)}" to false
    } else {
      "без сроков" to false
    }
  }

  StudyCard(modifier = Modifier.width(210.dp)) {
    Row(
      modifier = Modifier.padding(12.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Box(
        modifier = Modifier
          .size(36.dp)
          .clip(RoundedCornerShape(10.dp))
          .background(subColor.copy(alpha = 0.14f)),
        contentAlignment = Alignment.Center,
      ) {
        Text(
          text = DateHelpers.subjectShort(subject.name),
          style = MaterialTheme.typography.labelLarge,
          color = subColor,
          fontWeight = FontWeight.Bold,
        )
      }
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = subject.name,
          style = MaterialTheme.typography.bodyMedium,
          fontWeight = FontWeight.SemiBold,
          color = colors.fg,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        Text(
          text = subtitle.first,
          style = MaterialTheme.typography.labelSmall,
          color = if (subtitle.second) colors.urgent else colors.muted,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}
