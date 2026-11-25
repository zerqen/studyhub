package ru.studyhub.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.SrsEngine
import ru.studyhub.app.data.SrsState
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.SyncStatusPill
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private data class StudySession(
  val title: String,
  val queue: List<QuestionDto>,
  val initialTotal: Int,
  val reviewedCount: Int = 0,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(
  snapshot: StudyHubSnapshot,
  onSync: () -> Unit,
  onReviewQuestion: (questionId: String, grade: Int) -> Unit,
) {
  var activeSession by remember { mutableStateOf<StudySession?>(null) }

  val current = activeSession
  if (current != null) {
    ActiveReviewSessionView(
      session = current,
      subjects = snapshot.subjects,
      onBack = { activeSession = null },
      onGrade = { card, grade ->
        onReviewQuestion(card.id, grade)
        val remaining = current.queue.drop(1)
        val nextQueue = if (grade == 0) remaining + card else remaining
        activeSession = current.copy(
          queue = nextQueue,
          reviewedCount = current.reviewedCount + 1,
        )
      },
    )
    return
  }

  val colors = StudyHubThemeColors.current
  val questionsBySubject = remember(snapshot.questions) {
    snapshot.questions.groupBy { it.subjectId }
  }

  val dueAll = remember(snapshot.questions) {
    snapshot.questions.filter { it.srsReps > 0 && SrsEngine.isDue(it.srsDue) }
  }
  val newAll = remember(snapshot.questions) {
    snapshot.questions.filter { it.srsReps == 0 }
  }
  val learnedAll = remember(snapshot.questions) {
    snapshot.questions.count { it.status == "LEARNED" }
  }

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
          Text("Повторение", style = MaterialTheme.typography.headlineLarge, color = colors.fg)
          SyncStatusPill(
            isSyncing = snapshot.isSyncing,
            pendingOpsCount = snapshot.pendingOpsCount,
            lastError = snapshot.lastError,
            onSyncClick = onSync,
          )
        }
      }

      if (snapshot.questions.isEmpty()) {
        item {
          StudyCard {
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 28.dp),
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              Text("Пока нет вопросов", style = MaterialTheme.typography.titleMedium, color = colors.fg)
              Text(
                text = "Добавь вопросы или билеты на сайте — они автоматически загрузятся сюда для оффлайн-повторения",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            }
          }
        }
      } else {
        // Summary & Quick Start Card
        item {
          StudyCard {
            Column(
              modifier = Modifier.padding(16.dp),
              verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
              ) {
                SummaryStat(label = "К повтору", value = dueAll.size.toString(), color = colors.urgent)
                SummaryStat(label = "Новые", value = newAll.size.toString(), color = colors.accent)
                SummaryStat(label = "Выучено", value = learnedAll.toString(), color = colors.success)
              }

              Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
              ) {
                Icon(
                  imageVector = Icons.Rounded.CloudOff,
                  contentDescription = null,
                  tint = colors.muted,
                  modifier = Modifier.size(15.dp),
                )
                Text(
                  text = "Все ${snapshot.questions.size} карточек сохранены оффлайн — можно учить в метро",
                  style = MaterialTheme.typography.labelMedium,
                  color = colors.muted,
                )
              }

              val primaryCards = if (dueAll.isNotEmpty()) dueAll else newAll.take(20)
              if (primaryCards.isNotEmpty()) {
                Button(
                  onClick = {
                    activeSession = StudySession(
                      title = if (dueAll.isNotEmpty()) "Повторение на сегодня" else "Новые вопросы",
                      queue = primaryCards,
                      initialTotal = primaryCards.size,
                    )
                  },
                  modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                  shape = RoundedCornerShape(12.dp),
                  colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
                ) {
                  val btnText = if (dueAll.isNotEmpty()) {
                    "Повторить (${dueAll.size})"
                  } else {
                    "Учить новые (${primaryCards.size})"
                  }
                  Text(btnText, color = Color.White, style = MaterialTheme.typography.titleMedium)
                }
              }

              if (dueAll.isNotEmpty() && newAll.isNotEmpty()) {
                val batch = newAll.take(15)
                OutlinedButton(
                  onClick = {
                    activeSession = StudySession(
                      title = "Новые вопросы",
                      queue = batch,
                      initialTotal = batch.size,
                    )
                  },
                  modifier = Modifier.fillMaxWidth(),
                  shape = RoundedCornerShape(12.dp),
                ) {
                  Text("Плюс учить новые (${batch.size} из ${newAll.size})")
                }
              }
            }
          }
        }

        // Subject Decks
        item {
          Text("Колоды по предметам", style = MaterialTheme.typography.headlineMedium, color = colors.fg)
        }

        val decks = snapshot.subjects.filter { !questionsBySubject[it.id].isNullOrEmpty() }
        items(decks, key = { it.id }) { subject ->
          val qs = questionsBySubject[subject.id].orEmpty()
          SubjectDeckCard(
            subject = subject,
            questions = qs,
            onClick = {
              val dueSub = qs.filter { it.srsReps > 0 && SrsEngine.isDue(it.srsDue) }
              val newSub = qs.filter { it.srsReps == 0 }
              val queue = when {
                dueSub.isNotEmpty() -> dueSub + newSub.take(10)
                newSub.isNotEmpty() -> newSub.take(20)
                else -> qs.take(20)
              }
              activeSession = StudySession(
                title = subject.name,
                queue = queue,
                initialTotal = queue.size,
              )
            },
          )
        }
      }

      item { Spacer(modifier = Modifier.height(84.dp)) }
    }
  }
}

@Composable
private fun SummaryStat(label: String, value: String, color: Color) {
  val colors = StudyHubThemeColors.current
  Column(horizontalAlignment = Alignment.CenterHorizontally) {
    Text(
      text = value,
      style = MaterialTheme.typography.headlineMedium,
      color = color,
    )
    Text(
      text = label,
      style = MaterialTheme.typography.labelMedium,
      color = colors.muted,
    )
  }
}

@Composable
private fun SubjectDeckCard(
  subject: SubjectDto,
  questions: List<QuestionDto>,
  onClick: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val subColor = parseHexColor(subject.color, colors.accent)
  val dueCount = questions.count { it.srsReps > 0 && SrsEngine.isDue(it.srsDue) }
  val newCount = questions.count { it.srsReps == 0 }
  val learnedCount = questions.count { it.status == "LEARNED" }
  val progress = if (questions.isNotEmpty()) learnedCount.toFloat() / questions.size.toFloat() else 0f

  Surface(
    onClick = onClick,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Box(
          modifier = Modifier
            .size(38.dp)
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
            style = MaterialTheme.typography.titleMedium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
          Text(
            text = "Выучено $learnedCount из ${questions.size} · новых: $newCount",
            style = MaterialTheme.typography.labelMedium,
            color = colors.muted,
          )
        }

        if (dueCount > 0) {
          Box(
            modifier = Modifier
              .clip(RoundedCornerShape(8.dp))
              .background(colors.urgentSoft)
              .padding(horizontal = 8.dp, vertical = 4.dp),
          ) {
            Text(
              text = "$dueCount повторить",
              style = MaterialTheme.typography.labelSmall,
              color = colors.urgent,
              fontWeight = FontWeight.SemiBold,
            )
          }
        }
      }

      LinearProgressIndicator(
        progress = { progress.coerceIn(0f, 1f) },
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

@Composable
private fun ActiveReviewSessionView(
  session: StudySession,
  subjects: List<SubjectDto>,
  onBack: () -> Unit,
  onGrade: (QuestionDto, Int) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val subjectsById = remember(subjects) { subjects.associateBy { it.id } }
  val card = session.queue.firstOrNull()
  var revealed by remember(card?.id, session.reviewedCount) { mutableStateOf(false) }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .padding(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    // Top Session Bar
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      IconButton(onClick = onBack) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Назад", tint = colors.fg)
      }
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = session.title,
          style = MaterialTheme.typography.titleMedium,
          color = colors.fg,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        Text(
          text = if (card == null) "Завершено" else "Осталось в колоде: ${session.queue.size} · отвечено: ${session.reviewedCount}",
          style = MaterialTheme.typography.labelMedium,
          color = colors.muted,
        )
      }
    }

    val progress = if (session.initialTotal > 0) {
      ((session.initialTotal - session.queue.size).coerceAtLeast(0).toFloat() / session.initialTotal.toFloat())
    } else {
      1f
    }
    LinearProgressIndicator(
      progress = { progress.coerceIn(0f, 1f) },
      modifier = Modifier
        .fillMaxWidth()
        .height(5.dp)
        .clip(RoundedCornerShape(3.dp)),
      color = colors.accent,
      trackColor = colors.subtle,
    )

    if (card == null) {
      Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        StudyCard {
          Column(
            modifier = Modifier
              .fillMaxWidth()
              .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
          ) {
            Icon(
              imageVector = Icons.Rounded.CheckCircle,
              contentDescription = null,
              tint = colors.success,
              modifier = Modifier.size(44.dp),
            )
            Text("Сессия завершена!", style = MaterialTheme.typography.headlineMedium, color = colors.fg)
            Text(
              text = "Повторено ответов: ${session.reviewedCount}. Прогресс сохранён локально и синхронизируется с сайтом.",
              style = MaterialTheme.typography.bodyMedium,
              color = colors.muted,
            )
            Button(
              onClick = onBack,
              shape = RoundedCornerShape(12.dp),
              colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
              modifier = Modifier.fillMaxWidth(),
            ) {
              Text("К колодам", color = Color.White)
            }
          }
        }
      }
      return
    }

    // Flashcard Content
    val subject = subjectsById[card.subjectId]
    val srsState = remember(card) {
      SrsState(
        interval = card.srsInterval,
        ease = card.srsEase,
        reps = card.srsReps,
        lapses = card.srsLapses,
      )
    }

    Column(
      modifier = Modifier
        .weight(1f)
        .verticalScroll(rememberScrollState()),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      StudyCard {
        Column(
          modifier = Modifier.padding(18.dp),
          verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            if (subject != null) {
              Text(
                text = "${subject.emoji} ${subject.name}",
                style = MaterialTheme.typography.labelLarge,
                color = parseHexColor(subject.color, colors.accent),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
              )
            }
            val tag = buildString {
              if (card.ticketNo != null) append("Билет №${card.ticketNo}")
              else if (!card.lectureTitle.isNullOrBlank()) append(card.lectureTitle)
            }
            if (tag.isNotBlank()) {
              Text(
                text = tag,
                style = MaterialTheme.typography.labelSmall,
                color = colors.muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
              )
            }
          }

          Text(
            text = card.text,
            style = MaterialTheme.typography.titleLarge,
            color = colors.fg,
          )

          if (revealed) {
            HorizontalDivider(color = colors.line)
            if (!card.answer.isNullOrBlank()) {
              Text(
                text = card.answer,
                style = MaterialTheme.typography.bodyLarge,
                color = colors.fg,
              )
            } else {
              Text(
                text = "Ответ к этому вопросу не заполнен.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
              )
            }
            if (!card.explanation.isNullOrBlank()) {
              Box(
                modifier = Modifier
                  .fillMaxWidth()
                  .clip(RoundedCornerShape(10.dp))
                  .background(colors.subtle)
                  .padding(12.dp),
              ) {
                Text(
                  text = card.explanation,
                  style = MaterialTheme.typography.bodyMedium,
                  color = colors.muted,
                )
              }
            }
          }
        }
      }
    }

    // Bottom Reveal or Grade Buttons
    if (!revealed) {
      Button(
        onClick = { revealed = true },
        modifier = Modifier
          .fillMaxWidth()
          .height(52.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
      ) {
        Icon(Icons.Rounded.Visibility, contentDescription = null, tint = Color.White)
        Spacer(modifier = Modifier.width(8.dp))
        Text("Показать ответ", color = Color.White, style = MaterialTheme.typography.titleMedium)
      }
    } else {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          GradeButton(
            label = "Не вспомнил",
            sub = SrsEngine.whenLabel(srsState, 0),
            bg = colors.urgentSoft,
            fg = colors.urgent,
            modifier = Modifier.weight(1f),
            onClick = { onGrade(card, 0) },
          )
          GradeButton(
            label = "С трудом",
            sub = SrsEngine.whenLabel(srsState, 1),
            bg = colors.subtle,
            fg = colors.warning,
            modifier = Modifier.weight(1f),
            onClick = { onGrade(card, 1) },
          )
        }
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          GradeButton(
            label = "Вспомнил",
            sub = SrsEngine.whenLabel(srsState, 2),
            bg = colors.accentSoft,
            fg = colors.accent,
            modifier = Modifier.weight(1f),
            onClick = { onGrade(card, 2) },
          )
          GradeButton(
            label = "Легко",
            sub = SrsEngine.whenLabel(srsState, 3),
            bg = colors.subtle,
            fg = colors.success,
            modifier = Modifier.weight(1f),
            onClick = { onGrade(card, 3) },
          )
        }
      }
    }
  }
}

@Composable
private fun GradeButton(
  label: String,
  sub: String,
  bg: Color,
  fg: Color,
  modifier: Modifier = Modifier,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = modifier.height(56.dp),
    shape = RoundedCornerShape(12.dp),
    color = bg,
    border = BorderStroke(1.dp, fg.copy(alpha = 0.25f)),
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 8.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Text(label, style = MaterialTheme.typography.labelLarge, color = fg, fontWeight = FontWeight.SemiBold)
      Text(sub, style = MaterialTheme.typography.labelSmall, color = fg.copy(alpha = 0.85f))
    }
  }
}
