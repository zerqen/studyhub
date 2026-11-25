package ru.studyhub.app.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.studyhub.app.MainActivity
import ru.studyhub.app.StudyHubApplication
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TaskKind

private val KEY_TASK_ID = ActionParameters.Key<String>("task_id")

object DeadlinesWidgetUpdater {
  suspend fun updateAll(context: Context) {
    DeadlinesWidget().updateAll(context)
  }
}

class DeadlinesWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = DeadlinesWidget()
}

class ToggleWidgetTaskAction : ActionCallback {
  override suspend fun onAction(
    context: Context,
    glanceId: GlanceId,
    parameters: ActionParameters,
  ) {
    val taskId = parameters[KEY_TASK_ID] ?: return
    val app = context.applicationContext as? StudyHubApplication ?: return
    app.repository.toggleTaskDone(taskId)
    DeadlinesWidget().update(context, glanceId)
  }
}

class RefreshWidgetAction : ActionCallback {
  override suspend fun onAction(
    context: Context,
    glanceId: GlanceId,
    parameters: ActionParameters,
  ) {
    val app = context.applicationContext as? StudyHubApplication ?: return
    app.repository.syncNow()
    DeadlinesWidget().update(context, glanceId)
  }
}

class DeadlinesWidget : GlanceAppWidget() {
  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val app = context.applicationContext as? StudyHubApplication
    val session = app?.sessionStore?.current()
    val snapshot = withContext(Dispatchers.IO) { app?.database?.readSnapshot() }

    val loggedIn = session?.isLoggedIn == true
    val subjectsById = snapshot?.subjects?.associateBy { it.id }.orEmpty()
    val allTasks = snapshot?.tasks.orEmpty()
    val overdueCount = allTasks.count { DateHelpers.isOverdue(it) }
    val deadlines = DateHelpers.nearestDeadlines(allTasks, limit = 5)
    val pendingCount = snapshot?.pendingOpsCount ?: 0

    provideContent {
      DeadlinesWidgetContent(
        loggedIn = loggedIn,
        deadlines = deadlines,
        subjectsById = subjectsById,
        overdueCount = overdueCount,
        pendingCount = pendingCount,
      )
    }
  }
}

@Composable
private fun DeadlinesWidgetContent(
  loggedIn: Boolean,
  deadlines: List<TaskDto>,
  subjectsById: Map<String, SubjectDto>,
  overdueCount: Int,
  pendingCount: Int,
) {
  val bg = ColorProvider(Color(0xFFFFFEFB))
  val subtle = ColorProvider(Color(0xFFF3F1EC))
  val fg = ColorProvider(Color(0xFF1D2130))
  val muted = ColorProvider(Color(0xFF575B6A))
  val accent = ColorProvider(Color(0xFF2D5BD2))
  val urgent = ColorProvider(Color(0xFF8F3510))
  val urgentBg = ColorProvider(Color(0xFFFBE3CF))
  val accentSoft = ColorProvider(Color(0xFFE8EEFC))

  Column(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(bg)
      .cornerRadius(18.dp)
      .padding(14.dp),
  ) {
    // Header
    Row(
      modifier = GlanceModifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(
        modifier = GlanceModifier
          .defaultWeight()
          .clickable(actionStartActivity<MainActivity>()),
      ) {
        Text(
          text = "Дедлайны",
          style = TextStyle(color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold),
        )
        if (pendingCount > 0) {
          Text(
            text = "Оффлайн · $pendingCount не синхр.",
            style = TextStyle(color = muted, fontSize = 11.sp),
          )
        }
      }

      if (overdueCount > 0) {
        Box(
          modifier = GlanceModifier
            .background(urgentBg)
            .cornerRadius(8.dp)
            .padding(horizontal = 8.dp, vertical = 3.dp)
            .clickable(actionStartActivity<MainActivity>()),
        ) {
          Text(
            text = "Просрочено: $overdueCount",
            style = TextStyle(color = urgent, fontSize = 11.sp, fontWeight = FontWeight.Bold),
          )
        }
        Spacer(modifier = GlanceModifier.width(6.dp))
      }

      Box(
        modifier = GlanceModifier
          .background(subtle)
          .cornerRadius(8.dp)
          .padding(horizontal = 8.dp, vertical = 4.dp)
          .clickable(actionRunCallback<RefreshWidgetAction>()),
      ) {
        Text(
          text = "↻",
          style = TextStyle(color = accent, fontSize = 14.sp, fontWeight = FontWeight.Bold),
        )
      }
    }

    Spacer(modifier = GlanceModifier.height(10.dp))

    when {
      !loggedIn -> {
        Box(
          modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>()),
          contentAlignment = Alignment.Center,
        ) {
          Text(
            text = "Войди в StudyHub, чтобы видеть дедлайны",
            style = TextStyle(color = muted, fontSize = 13.sp),
          )
        }
      }
      deadlines.isEmpty() -> {
        Box(
          modifier = GlanceModifier
            .fillMaxSize()
            .clickable(actionStartActivity<MainActivity>()),
          contentAlignment = Alignment.Center,
        ) {
          Text(
            text = "Открытых дедлайнов нет — всё сдано!",
            style = TextStyle(color = muted, fontSize = 13.sp),
          )
        }
      }
      else -> {
        Column(modifier = GlanceModifier.fillMaxWidth()) {
          deadlines.forEachIndexed { idx, task ->
            val (dueLabel, isUrgent) = DateHelpers.formatDueShort(task.dueDate, task.dueTime)
            val subject = task.subjectId?.let { subjectsById[it] }
            val kind = TaskKind.fromWire(task.kind)

            Row(
              modifier = GlanceModifier
                .fillMaxWidth()
                .background(subtle)
                .cornerRadius(10.dp)
                .padding(horizontal = 10.dp, vertical = 7.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              // Interactive check button right on widget
              Box(
                modifier = GlanceModifier
                  .size(22.dp)
                  .background(accentSoft)
                  .cornerRadius(11.dp)
                  .clickable(
                    actionRunCallback<ToggleWidgetTaskAction>(
                      actionParametersOf(KEY_TASK_ID to task.id),
                    ),
                  ),
                contentAlignment = Alignment.Center,
              ) {
                Text(
                  text = "○",
                  style = TextStyle(color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                )
              }

              Spacer(modifier = GlanceModifier.width(8.dp))

              Column(
                modifier = GlanceModifier
                  .defaultWeight()
                  .clickable(actionStartActivity<MainActivity>()),
              ) {
                Text(
                  text = task.title,
                  maxLines = 1,
                  style = TextStyle(color = fg, fontSize = 13.sp, fontWeight = FontWeight.Medium),
                )
                val subLine = buildString {
                  if (kind != TaskKind.TASK) {
                    append(kind.shortLabel)
                    append(" · ")
                  }
                  if (subject != null) {
                    append(subject.name)
                  }
                }
                if (subLine.isNotBlank()) {
                  Text(
                    text = subLine,
                    maxLines = 1,
                    style = TextStyle(color = muted, fontSize = 11.sp),
                  )
                }
              }

              Spacer(modifier = GlanceModifier.width(6.dp))

              Text(
                text = dueLabel,
                maxLines = 1,
                style = TextStyle(
                  color = if (isUrgent) urgent else muted,
                  fontSize = 11.sp,
                  fontWeight = if (isUrgent) FontWeight.Bold else FontWeight.Normal,
                ),
              )
            }

            if (idx < deadlines.lastIndex) {
              Spacer(modifier = GlanceModifier.height(6.dp))
            }
          }
        }
      }
    }
  }
}
