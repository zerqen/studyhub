package ru.studyhub.app.ui.components

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AudioFile
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File
import java.util.Locale
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.QuickTaskParsed
import ru.studyhub.app.data.QuickTaskParser
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


@OptIn(ExperimentalLayoutApi::class)
@Composable
fun QuickAddTaskBar(
  subjects: List<SubjectDto>,
  onQuickCreate: (QuickTaskParsed) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  var input by rememberSaveable { mutableStateOf("") }
  val parsed = remember(input, subjects) {
    if (input.isBlank()) null else QuickTaskParser.parse(input, subjects)
  }

  fun submit() {
    val p = parsed ?: return
    if (p.title.isBlank()) return
    onQuickCreate(p)
    input = ""
  }

  StudyCard {
    Column(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        OutlinedTextField(
          value = input,
          onValueChange = { input = it },
          placeholder = { Text("Быстро: «ДЗ матан завтра 18:00»", maxLines = 1) },
          singleLine = true,
          shape = RoundedCornerShape(12.dp),
          keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
          keyboardActions = KeyboardActions(onDone = { submit() }),
          modifier = Modifier.weight(1f),
        )
        Surface(
          onClick = { submit() },
          enabled = parsed != null,
          shape = RoundedCornerShape(12.dp),
          color = if (parsed != null) colors.accent else colors.subtle,
          modifier = Modifier.size(48.dp),
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(
              imageVector = Icons.Rounded.Add,
              contentDescription = "Добавить",
              tint = if (parsed != null) Color.White else colors.muted,
            )
          }
        }
      }

      if (parsed != null) {
        FlowRow(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          if (parsed.kind != TaskKind.TASK) {
            QuickBadge(text = parsed.kind.shortLabel, bg = colors.accentSoft, fg = colors.accent)
          }
          if (parsed.subjectName != null) {
            QuickBadge(text = parsed.subjectName, bg = colors.subtle, fg = colors.fg)
          }
          if (parsed.dueDateLabel != null) {
            QuickBadge(text = parsed.dueDateLabel, bg = colors.urgentSoft, fg = colors.urgent)
          }
          QuickBadge(text = "«${parsed.title}»", bg = colors.subtle, fg = colors.muted)
        }
      }
    }
  }
}

@Composable
private fun QuickBadge(text: String, bg: Color, fg: Color) {
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(6.dp))
      .background(bg)
      .padding(horizontal = 7.dp, vertical = 3.dp),
  ) {
    Text(text = text, style = MaterialTheme.typography.labelSmall, color = fg, maxLines = 1)
  }
}

@Composable
fun SwipeableTaskRow(
  task: TaskDto,
  subject: SubjectDto?,
  onToggleDone: () -> Unit,
  onPostponeTomorrow: () -> Unit,
  onClick: () -> Unit,
  showDueDate: Boolean = true,
) {
  val colors = StudyHubThemeColors.current
  val dismissState = rememberSwipeToDismissBoxState(
    confirmValueChange = { value ->
      when (value) {
        SwipeToDismissBoxValue.StartToEnd -> onToggleDone()
        SwipeToDismissBoxValue.EndToStart -> onPostponeTomorrow()
        SwipeToDismissBoxValue.Settled -> Unit
      }
      false
    },
  )

  SwipeToDismissBox(
    state = dismissState,
    backgroundContent = {
      val dir = dismissState.dismissDirection
      val isRight = dir == SwipeToDismissBoxValue.StartToEnd
      val isLeft = dir == SwipeToDismissBoxValue.EndToStart
      val bg = when {
        isRight -> colors.success.copy(alpha = 0.16f)
        isLeft -> colors.accentSoft
        else -> Color.Transparent
      }
      val fg = when {
        isRight -> colors.success
        isLeft -> colors.accent
        else -> colors.muted
      }
      Row(
        modifier = Modifier
          .fillMaxSize()
          .background(bg)
          .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (isRight) Arrangement.Start else Arrangement.End,
      ) {
        if (isRight) {
          Icon(Icons.Rounded.Check, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
          Spacer(modifier = Modifier.width(6.dp))
          Text(
            text = if (task.status == "DONE") "Вернуть" else "Готово",
            style = MaterialTheme.typography.labelLarge,
            color = fg,
          )
        } else if (isLeft) {
          Text("На завтра", style = MaterialTheme.typography.labelLarge, color = fg)
          Spacer(modifier = Modifier.width(6.dp))
          Icon(Icons.Rounded.Schedule, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
        }
      }
    },
  ) {
    Box(modifier = Modifier.background(colors.surface)) {
      TaskRowItem(
        task = task,
        subject = subject,
        onToggleDone = onToggleDone,
        onClick = onClick,
        showDueDate = showDueDate,
      )
    }
  }
}

@Composable
fun AttachmentRowItem(
  attachment: AttachmentDto,
  isCached: Boolean,
  isBusy: Boolean,
  isTranscribing: Boolean = false,
  onOpen: () -> Unit,
  onTranscribe: (() -> Unit)? = null,
  onDelete: (() -> Unit)? = null,
) {
  val colors = StudyHubThemeColors.current
  val isPdf = attachment.mimeType.contains("pdf", ignoreCase = true) ||
    attachment.originalName.endsWith(".pdf", ignoreCase = true)
  val isAudio = attachment.mimeType.startsWith("audio/", ignoreCase = true)
  val isImage = attachment.mimeType.startsWith("image/", ignoreCase = true)

  val (icon, iconTint) = when {
    isPdf -> Icons.Rounded.PictureAsPdf to colors.urgent
    isAudio -> Icons.Rounded.AudioFile to colors.accent
    isImage -> Icons.Rounded.Image to colors.success
    else -> Icons.Rounded.Description to colors.muted
  }

  Surface(
    onClick = onOpen,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(12.dp),
    color = colors.subtle.copy(alpha = 0.65f),
    border = BorderStroke(1.dp, colors.line),
  ) {
    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        if (isBusy) {
          CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp, color = colors.accent)
        } else {
          Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(24.dp))
        }

        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = attachment.originalName,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = colors.fg,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
          val meta = buildString {
            append(formatBytes(attachment.size))
            if (isCached) append(" · Оффлайн")
          }
          Text(
            text = meta,
            style = MaterialTheme.typography.labelSmall,
            color = if (isCached) colors.success else colors.muted,
          )
        }

        if (onDelete != null) {
          IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
            Icon(
              Icons.Rounded.DeleteOutline,
              contentDescription = "Удалить файл",
              tint = colors.muted,
              modifier = Modifier.size(18.dp),
            )
          }
        }
      }

      if (isAudio && onTranscribe != null) {
        OutlinedButton(
          onClick = onTranscribe,
          enabled = !isTranscribing,
          shape = RoundedCornerShape(10.dp),
          modifier = Modifier.fillMaxWidth(),
        ) {
          if (isTranscribing) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = colors.accent)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Расшифровываем…")
          } else {
            Icon(Icons.Rounded.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("Расшифровать аудио (ИИ)")
          }
        }
      }
    }
  }
}

fun formatBytes(bytes: Long): String = when {
  bytes < 1024L -> "$bytes Б"
  bytes < 1024L * 1024L -> "${bytes / 1024L} КБ"
  else -> String.format(Locale.US, "%.1f МБ", bytes / (1024.0 * 1024.0))
}

fun openFileWithSystemViewer(context: Context, file: File, mimeType: String) {
  val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
  val intent = Intent(Intent.ACTION_VIEW).apply {
    setDataAndType(uri, mimeType.ifBlank { "*/*" })
    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
  }
  try {
    context.startActivity(Intent.createChooser(intent, file.name))
  } catch (_: ActivityNotFoundException) {
    Toast.makeText(context, "На телефоне нет приложения для открытия этого файла", Toast.LENGTH_LONG).show()
  }
}
