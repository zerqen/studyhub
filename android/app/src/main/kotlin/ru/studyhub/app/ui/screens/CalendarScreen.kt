package ru.studyhub.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.School
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import ru.studyhub.app.data.AuthSession
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.SrsEngine
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TodayEventDto
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.components.TaskRowItem
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private data class DayMarkers(
  val dots: List<Color>,
  val hasOverdue: Boolean,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
  session: AuthSession,
  snapshot: StudyHubSnapshot,
  onSync: () -> Unit,
  onToggleShowLessons: (Boolean) -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
  onCreateTaskOnDate: (LocalDate) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val ruLocale = remember { Locale.forLanguageTag("ru-RU") }
  val today = remember { DateHelpers.today() }
  var currentMonth by remember { mutableStateOf(YearMonth.from(today)) }
  var selectedDate by remember { mutableStateOf(today) }
  var showDone by rememberSaveable { mutableStateOf(false) }

  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }

  val visibleEvents = remember(snapshot.calendarEvents, session.showLessons) {
    snapshot.calendarEvents.filter { ev ->
      session.showLessons || !SrsEngine.isLessonKind(ev.kind)
    }
  }

  val tasksByDate = remember(snapshot.tasks, showDone) {
    snapshot.tasks
      .filter { it.status != "CANCELLED" && (showDone || it.status != "DONE") }
      .mapNotNull { task -> DateHelpers.parseDateOnly(task.dueDate)?.let { it to task } }
      .groupBy({ it.first }, { it.second })
  }

  val examsByDate = remember(snapshot.subjects) {
    snapshot.subjects
      .mapNotNull { sub -> DateHelpers.parseDateOnly(sub.examDate)?.let { it to sub } }
      .groupBy({ it.first }, { it.second })
  }

  val eventsByDate = remember(visibleEvents) {
    visibleEvents
      .mapNotNull { ev ->
        runCatching { Instant.parse(ev.start).atZone(ZoneId.systemDefault()).toLocalDate() }
          .getOrNull()
          ?.let { it to ev }
      }
      .groupBy({ it.first }, { it.second })
  }

  val markersByDate = remember(tasksByDate, examsByDate, eventsByDate, subjectsById, today, colors) {
    val allDates = (tasksByDate.keys + examsByDate.keys + eventsByDate.keys).toSet()
    allDates.associateWith { date ->
      val dots = mutableListOf<Color>()
      var hasOverdue = false
      examsByDate[date].orEmpty().forEach { exam ->
        dots += parseHexColor(exam.color, colors.danger)
      }
      tasksByDate[date].orEmpty().forEach { task ->
        val overdue = DateHelpers.isOverdue(task, today)
        if (overdue) hasOverdue = true
        val c = if (overdue) {
          colors.urgent
        } else {
          parseHexColor(task.subjectId?.let { subjectsById[it]?.color }, colors.accent)
        }
        dots += c
      }
      eventsByDate[date].orEmpty().forEach { ev ->
        dots += parseHexColor(ev.color, colors.accent)
      }
      DayMarkers(dots = dots.take(3), hasOverdue = hasOverdue)
    }
  }

  val monthTitle = remember(currentMonth, ruLocale) {
    currentMonth.atDay(1)
      .format(DateTimeFormatter.ofPattern("LLLL yyyy", ruLocale))
      .replaceFirstChar { it.uppercase(ruLocale) }
  }

  val selectedDateTitle = remember(selectedDate, ruLocale) {
    selectedDate
      .format(DateTimeFormatter.ofPattern("EEEE, d MMMM", ruLocale))
      .replaceFirstChar { it.uppercase(ruLocale) }
  }

  val gridDays = remember(currentMonth) {
    val firstOfMonth = currentMonth.atDay(1)
    val startOffset = firstOfMonth.dayOfWeek.value - 1 // Monday = 0
    val startDate = firstOfMonth.minusDays(startOffset.toLong())
    val lastOfMonth = currentMonth.atEndOfMonth()
    val endOffset = 7 - lastOfMonth.dayOfWeek.value
    val totalDays = startOffset + currentMonth.lengthOfMonth() + endOffset
    (0 until totalDays).map { startDate.plusDays(it.toLong()) }
  }

  val dayExams = examsByDate[selectedDate].orEmpty()
  val dayTasks = tasksByDate[selectedDate].orEmpty()
  val dayEvents = eventsByDate[selectedDate].orEmpty()

  PullToRefreshBox(
    isRefreshing = snapshot.isSyncing,
    onRefresh = onSync,
    modifier = Modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text("Календарь", style = MaterialTheme.typography.headlineLarge, color = colors.fg)
          SyncStatusPill(
            isSyncing = snapshot.isSyncing,
            pendingOpsCount = snapshot.pendingOpsCount,
            lastError = snapshot.lastError,
            onSyncClick = onSync,
          )
        }
      }

      // Filter toggles
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          FilterChip(
            selected = !session.showLessons,
            onClick = { onToggleShowLessons(!session.showLessons) },
            label = { Text(if (session.showLessons) "Скрыть пары" else "Пары скрыты") },
          )
          FilterChip(
            selected = showDone,
            onClick = { showDone = !showDone },
            label = { Text("Сделанные") },
          )
        }
      }

      // Month Grid Card
      item {
        StudyCard {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            IconButton(onClick = { currentMonth = currentMonth.minusMonths(1) }) {
              Icon(Icons.Rounded.ChevronLeft, contentDescription = "Предыдущий месяц", tint = colors.fg)
            }
            Text(
              text = monthTitle,
              style = MaterialTheme.typography.titleLarge,
              color = colors.fg,
              modifier = Modifier.weight(1f),
              textAlign = TextAlign.Center,
            )
            TextButton(
              onClick = {
                currentMonth = YearMonth.from(today)
                selectedDate = today
              },
            ) {
              Text("Сегодня", style = MaterialTheme.typography.labelLarge)
            }
            IconButton(onClick = { currentMonth = currentMonth.plusMonths(1) }) {
              Icon(Icons.Rounded.ChevronRight, contentDescription = "Следующий месяц", tint = colors.fg)
            }
          }

          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(horizontal = 8.dp, vertical = 4.dp),
          ) {
            listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс").forEachIndexed { idx, wd ->
              Text(
                text = wd,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.labelMedium,
                color = if (idx >= 5) colors.muted.copy(alpha = 0.7f) else colors.muted,
              )
            }
          }

          Column(modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)) {
            gridDays.chunked(7).forEach { week ->
              Row(modifier = Modifier.fillMaxWidth()) {
                week.forEach { day ->
                  val inMonth = YearMonth.from(day) == currentMonth
                  val isToday = day == today
                  val isSelected = day == selectedDate
                  val marker = markersByDate[day]

                  Box(
                    modifier = Modifier
                      .weight(1f)
                      .aspectRatio(1f)
                      .padding(2.dp)
                      .clip(RoundedCornerShape(10.dp))
                      .background(
                        when {
                          isSelected -> colors.accent
                          isToday -> colors.accentSoft
                          else -> Color.Transparent
                        },
                      )
                      .then(
                        if (isToday && !isSelected) {
                          Modifier.border(1.dp, colors.accent.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        } else {
                          Modifier
                        },
                      )
                      .clickable {
                        selectedDate = day
                        if (!inMonth) currentMonth = YearMonth.from(day)
                      },
                    contentAlignment = Alignment.Center,
                  ) {
                    Column(
                      horizontalAlignment = Alignment.CenterHorizontally,
                      verticalArrangement = Arrangement.Center,
                    ) {
                      Text(
                        text = day.dayOfMonth.toString(),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = when {
                          isSelected -> Color.White
                          !inMonth -> colors.muted.copy(alpha = 0.45f)
                          isToday -> colors.accent
                          else -> colors.fg
                        },
                      )
                      if (marker != null && marker.dots.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                          marker.dots.forEach { dotColor ->
                            Box(
                              modifier = Modifier
                                .size(5.dp)
                                .clip(CircleShape)
                                .background(if (isSelected) Color.White else dotColor),
                            )
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Selected day agenda
      item {
        StudyCard {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(
              text = selectedDateTitle,
              style = MaterialTheme.typography.titleLarge,
              color = colors.fg,
              modifier = Modifier.weight(1f),
            )
            FilledTonalButton(
              onClick = { onCreateTaskOnDate(selectedDate) },
              contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
              shape = RoundedCornerShape(10.dp),
            ) {
              Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(4.dp))
              Text("Задача", style = MaterialTheme.typography.labelLarge)
            }
          }

          if (dayExams.isEmpty() && dayTasks.isEmpty() && dayEvents.isEmpty()) {
            HorizontalDivider(color = colors.line)
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 22.dp),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
              Text("На этот день ничего не запланировано", style = MaterialTheme.typography.bodyMedium, color = colors.muted)
            }
          } else {
            dayExams.forEach { exam ->
              HorizontalDivider(color = colors.line)
              ExamAgendaRow(exam = exam)
            }

            dayTasks.forEach { task ->
              HorizontalDivider(color = colors.line)
              TaskRowItem(
                task = task,
                subject = task.subjectId?.let { subjectsById[it] },
                onToggleDone = { onToggleTask(task.id) },
                onClick = { onOpenTask(task) },
                showDueDate = false,
              )
            }

            dayEvents.forEach { ev ->
              HorizontalDivider(color = colors.line)
              EventAgendaRow(event = ev)
            }
          }
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }
}

@Composable
private fun ExamAgendaRow(exam: SubjectDto) {
  val colors = StudyHubThemeColors.current
  val examColor = parseHexColor(exam.color, colors.danger)
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(colors.urgentSoft.copy(alpha = 0.35f))
      .padding(horizontal = 14.dp, vertical = 11.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Icon(
      imageVector = Icons.Rounded.School,
      contentDescription = null,
      tint = examColor,
      modifier = Modifier.size(20.dp),
    )
    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = "Экзамен: ${exam.name}",
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = colors.fg,
      )
      if (exam.questionsTotal > 0) {
        Text(
          text = "Выучено ${exam.questionsLearned} из ${exam.questionsTotal}",
          style = MaterialTheme.typography.labelMedium,
          color = colors.muted,
        )
      }
    }
  }
}

@Composable
private fun EventAgendaRow(event: TodayEventDto) {
  val colors = StudyHubThemeColors.current
  val stripeColor = parseHexColor(event.color, colors.accent)
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
        text = event.title,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.Medium,
        color = colors.fg,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      val meta = listOfNotNull(
        event.kindLabel.takeIf { it.isNotBlank() },
        event.location?.takeIf { it.isNotBlank() },
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
      text = if (event.allDay) "Весь день" else DateHelpers.formatEventTime(event.start),
      style = MaterialTheme.typography.labelLarge,
      color = colors.fg,
    )
  }
}
