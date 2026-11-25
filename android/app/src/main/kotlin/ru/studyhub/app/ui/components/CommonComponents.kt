package ru.studyhub.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TaskKind
import ru.studyhub.app.ui.theme.StudyHubThemeColors

fun parseHexColor(hex: String?, fallback: Color): Color {
  if (hex.isNullOrBlank()) return fallback
  val cleaned = hex.trim().removePrefix("#")
  return runCatching {
    val value = cleaned.toLong(16)
    when (cleaned.length) {
      6 -> Color(0xFF000000L or value)
      8 -> Color(value)
      else -> fallback
    }
  }.getOrDefault(fallback)
}

@Composable
fun StudyCard(
  modifier: Modifier = Modifier,
  content: @Composable ColumnScope.() -> Unit,
) {
  val colors = StudyHubThemeColors.current
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(16.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Column(content = content)
  }
}

@Composable
fun TaskKindChip(kind: TaskKind) {
  val colors = StudyHubThemeColors.current
  val (bg, fg) = when (kind) {
    TaskKind.HOMEWORK -> colors.accentSoft to colors.accent
    TaskKind.TEST -> colors.urgentSoft to colors.urgent
    TaskKind.LAB -> colors.subtle to colors.fg
    TaskKind.DRAWING -> colors.subtle to colors.fg
    TaskKind.TASK -> return
  }
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(6.dp))
      .background(bg)
      .padding(horizontal = 6.dp, vertical = 2.dp),
  ) {
    Text(
      text = kind.shortLabel,
      style = MaterialTheme.typography.labelSmall,
      color = fg,
      fontWeight = FontWeight.SemiBold,
    )
  }
}

@Composable
fun TaskRowItem(
  task: TaskDto,
  subject: SubjectDto?,
  onToggleDone: () -> Unit,
  onClick: () -> Unit,
  showDueDate: Boolean = true,
) {
  val colors = StudyHubThemeColors.current
  val done = task.status == "DONE"
  val kind = TaskKind.fromWire(task.kind)
  val (dueLabel, dueUrgent) = DateHelpers.formatDueShort(task.dueDate, task.dueTime)
  val doneSubs = task.subtasks.count { it.status == "DONE" }

  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clickable(onClick = onClick)
      .padding(horizontal = 14.dp, vertical = 12.dp),
    verticalAlignment = Alignment.Top,
  ) {
    Box(
      modifier = Modifier
        .padding(top = 1.dp)
        .size(22.dp)
        .clip(CircleShape)
        .background(if (done) colors.accent else Color.Transparent)
        .border(
          width = 1.6.dp,
          color = when {
            done -> colors.accent
            task.priority == "CRITICAL" -> colors.danger
            task.priority == "HIGH" -> colors.urgent
            else -> colors.muted.copy(alpha = 0.55f)
          },
          shape = CircleShape,
        )
        .clickable(onClick = onToggleDone),
      contentAlignment = Alignment.Center,
    ) {
      if (done) {
        Icon(
          imageVector = Icons.Rounded.Check,
          contentDescription = "Выполнено",
          tint = Color.White,
          modifier = Modifier.size(14.dp),
        )
      }
    }

    Spacer(modifier = Modifier.width(12.dp))

    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(
        text = task.title,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.Medium,
        color = if (done) colors.muted else colors.fg,
        textDecoration = if (done) TextDecoration.LineThrough else TextDecoration.None,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )

      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        TaskKindChip(kind)

        if (subject != null) {
          val dotColor = parseHexColor(subject.color, colors.accent)
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Box(
              modifier = Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(dotColor),
            )
            Text(
              text = subject.name,
              style = MaterialTheme.typography.labelMedium,
              color = colors.muted,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )
          }
        }

        if (task.subtasks.isNotEmpty()) {
          Text(
            text = "· $doneSubs/${task.subtasks.size}",
            style = MaterialTheme.typography.labelMedium,
            color = colors.muted,
          )
        }
      }
    }

    if (showDueDate && task.dueDate != null) {
      Spacer(modifier = Modifier.width(8.dp))
      Text(
        text = dueLabel,
        style = MaterialTheme.typography.labelMedium,
        color = if (!done && dueUrgent) colors.urgent else colors.muted,
        fontWeight = if (!done && dueUrgent) FontWeight.SemiBold else FontWeight.Normal,
        maxLines = 1,
      )
    }
  }
}

@Composable
fun SyncStatusPill(
  isSyncing: Boolean,
  pendingOpsCount: Int,
  lastError: String?,
  onSyncClick: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val hasOffline = pendingOpsCount > 0 || (lastError != null && lastError.contains("Оффлайн", ignoreCase = true))

  Surface(
    onClick = onSyncClick,
    shape = RoundedCornerShape(999.dp),
    color = if (hasOffline) colors.urgentSoft else colors.surface,
    border = BorderStroke(1.dp, if (hasOffline) colors.urgent.copy(alpha = 0.35f) else colors.line),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      if (isSyncing) {
        CircularProgressIndicator(
          modifier = Modifier.size(14.dp),
          strokeWidth = 2.dp,
          color = colors.accent,
        )
        Text("Синхр…", style = MaterialTheme.typography.labelMedium, color = colors.muted)
      } else if (hasOffline) {
        Icon(
          imageVector = Icons.Rounded.CloudOff,
          contentDescription = null,
          tint = colors.urgent,
          modifier = Modifier.size(15.dp),
        )
        Text(
          text = if (pendingOpsCount > 0) "Оффлайн · $pendingOpsCount" else "Оффлайн",
          style = MaterialTheme.typography.labelMedium,
          color = colors.urgent,
          fontSize = 12.sp,
        )
      } else {
        Icon(
          imageVector = Icons.Rounded.Sync,
          contentDescription = "Синхронизировать",
          tint = colors.accent,
          modifier = Modifier.size(15.dp),
        )
        Text("Обновить", style = MaterialTheme.typography.labelMedium, color = colors.fg)
      }
    }
  }
}
