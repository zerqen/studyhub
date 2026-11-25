package ru.studyhub.app.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TaskKind
import ru.studyhub.app.data.TaskPriority
import ru.studyhub.app.ui.components.AttachmentRowItem
import ru.studyhub.app.ui.components.readPickedUriBytes
import ru.studyhub.app.ui.theme.StudyHubThemeColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateTaskSheet(
  subjects: List<SubjectDto>,
  initialDueDate: LocalDate? = DateHelpers.today().plusDays(1),
  onDismiss: () -> Unit,
  onCreate: (
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
    stages: List<String>,
  ) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var title by remember { mutableStateOf("") }
  var description by remember { mutableStateOf("") }
  var kind by remember { mutableStateOf(TaskKind.HOMEWORK) }
  var subjectId by remember { mutableStateOf<String?>(null) }
  var dueDate by remember(initialDueDate) { mutableStateOf(initialDueDate) }
  var dueTime by remember { mutableStateOf("") }
  var priority by remember { mutableStateOf(TaskPriority.MEDIUM) }
  var includeTemplateStages by remember { mutableStateOf(false) }
  var showDatePicker by remember { mutableStateOf(false) }

  val templateStages = TaskKind.stageTemplates[kind].orEmpty()

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.surface,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Text("Новая задача", style = MaterialTheme.typography.headlineMedium, color = colors.fg)

      OutlinedTextField(
        value = title,
        onValueChange = { title = it },
        label = { Text("Что нужно сделать") },
        placeholder = { Text("Например: ДЗ по матану, номера 14–18") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )

      // Kind chips
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Тип", style = MaterialTheme.typography.labelLarge, color = colors.muted)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(TaskKind.entries) { k ->
            FilterChip(
              selected = kind == k,
              onClick = {
                kind = k
                includeTemplateStages = TaskKind.stageTemplates.containsKey(k)
              },
              label = { Text(k.shortLabel) },
            )
          }
        }
      }

      if (templateStages.isNotEmpty()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = "Добавить шаблон этапов (${templateStages.size})",
              style = MaterialTheme.typography.bodyMedium,
              fontWeight = FontWeight.Medium,
              color = colors.fg,
            )
            Text(
              text = templateStages.take(3).joinToString(" → ") + "…",
              style = MaterialTheme.typography.labelSmall,
              color = colors.muted,
            )
          }
          Switch(checked = includeTemplateStages, onCheckedChange = { includeTemplateStages = it })
        }
      }

      // Subject chips
      if (subjects.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("Предмет", style = MaterialTheme.typography.labelLarge, color = colors.muted)
          LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
              FilterChip(
                selected = subjectId == null,
                onClick = { subjectId = null },
                label = { Text("Без предмета") },
              )
            }
            items(subjects, key = { it.id }) { s ->
              FilterChip(
                selected = subjectId == s.id,
                onClick = { subjectId = s.id },
                label = { Text("${s.emoji} ${s.name}") },
              )
            }
          }
        }
      }

      // Quick due date chips
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        val today = DateHelpers.today()
        val label = dueDate?.let { DateHelpers.formatDueShort(DateHelpers.formatIsoDate(it)).first } ?: "Без срока"
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text("Срок: $label", style = MaterialTheme.typography.labelLarge, color = colors.muted)
          TextButton(onClick = { showDatePicker = true }) {
            Icon(Icons.Rounded.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text("Выбрать дату")
          }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          item {
            FilterChip(selected = dueDate == today, onClick = { dueDate = today }, label = { Text("Сегодня") })
          }
          item {
            FilterChip(
              selected = dueDate == today.plusDays(1),
              onClick = { dueDate = today.plusDays(1) },
              label = { Text("Завтра") },
            )
          }
          item {
            FilterChip(
              selected = dueDate == today.plusDays(3),
              onClick = { dueDate = today.plusDays(3) },
              label = { Text("+3 дня") },
            )
          }
          item {
            FilterChip(
              selected = dueDate == today.plusDays(7),
              onClick = { dueDate = today.plusDays(7) },
              label = { Text("Через неделю") },
            )
          }
          item {
            FilterChip(selected = dueDate == null, onClick = { dueDate = null }, label = { Text("Без срока") })
          }
        }
      }

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
          value = dueTime,
          onValueChange = { if (it.length <= 5) dueTime = it },
          label = { Text("Время (ЧЧ:ММ)") },
          placeholder = { Text("18:00") },
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
      }

      // Priority chips
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Приоритет", style = MaterialTheme.typography.labelLarge, color = colors.muted)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          items(TaskPriority.entries) { p ->
            FilterChip(
              selected = priority == p,
              onClick = { priority = p },
              label = { Text(p.label) },
            )
          }
        }
      }

      OutlinedTextField(
        value = description,
        onValueChange = { description = it },
        label = { Text("Заметка / описание (необязательно)") },
        minLines = 2,
        maxLines = 4,
        modifier = Modifier.fillMaxWidth(),
      )

      Button(
        onClick = {
          val validTime = dueTime.trim().takeIf { Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(it) }
          onCreate(
            title.trim(),
            description.trim().ifBlank { null },
            subjectId,
            dueDate?.let { DateHelpers.formatIsoDate(it) },
            validTime,
            priority.wire,
            kind.wire,
            if (includeTemplateStages) templateStages else emptyList(),
          )
          onDismiss()
        },
        enabled = title.trim().isNotEmpty(),
        modifier = Modifier
          .fillMaxWidth()
          .height(50.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
      ) {
        Text("Сохранить задачу", style = MaterialTheme.typography.titleMedium, color = Color.White)
      }

      Spacer(modifier = Modifier.height(12.dp))
    }
  }

  if (showDatePicker) {
    val pickerState = rememberDatePickerState(
      initialSelectedDateMillis = dueDate?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
    )
    DatePickerDialog(
      onDismissRequest = { showDatePicker = false },
      confirmButton = {
        TextButton(
          onClick = {
            pickerState.selectedDateMillis?.let { millis ->
              dueDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
            }
            showDatePicker = false
          },
        ) { Text("ОК") }
      },
      dismissButton = {
        TextButton(onClick = { showDatePicker = false }) { Text("Отмена") }
      },
    ) {
      DatePicker(state = pickerState)
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailSheet(
  task: TaskDto,
  subjects: List<SubjectDto>,
  attachments: List<AttachmentDto> = emptyList(),
  busyAttachmentId: String? = null,
  isUploading: Boolean = false,
  isAttachmentCached: (AttachmentDto) -> Boolean = { false },
  onOpenAttachment: (AttachmentDto) -> Unit = {},
  onUploadFile: ((fileName: String, mimeType: String, bytes: ByteArray) -> Unit)? = null,
  onDeleteAttachment: ((String) -> Unit)? = null,
  onDismiss: () -> Unit,
  onToggleDone: () -> Unit,
  onSaveEdits: (
    title: String,
    description: String?,
    subjectId: String?,
    dueDate: String?,
    dueTime: String?,
    priority: String,
    kind: String,
  ) -> Unit,
  onDelete: () -> Unit,
  onAddSubtask: (String) -> Unit,
  onToggleSubtask: (String) -> Unit,
  onDeleteSubtask: (String) -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var title by remember(task.id) { mutableStateOf(task.title) }
  var description by remember(task.id) { mutableStateOf(task.description.orEmpty()) }
  var kind by remember(task.id) { mutableStateOf(TaskKind.fromWire(task.kind)) }
  var subjectId by remember(task.id) { mutableStateOf(task.subjectId) }
  var dueDate by remember(task.id) { mutableStateOf(DateHelpers.parseDateOnly(task.dueDate)) }
  var dueTime by remember(task.id) { mutableStateOf(task.dueTime.orEmpty()) }
  var priority by remember(task.id) { mutableStateOf(TaskPriority.fromWire(task.priority)) }
  var newSubtaskTitle by remember { mutableStateOf("") }
  var showDatePicker by remember { mutableStateOf(false) }
  var confirmDelete by remember { mutableStateOf(false) }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.surface,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .imePadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text("Детали задачи", style = MaterialTheme.typography.headlineMedium, color = colors.fg)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
          OutlinedButton(
            onClick = onToggleDone,
            shape = RoundedCornerShape(10.dp),
          ) {
            Text(if (task.status == "DONE") "Вернуть" else "Готово")
          }
          IconButton(onClick = { confirmDelete = true }) {
            Icon(Icons.Rounded.DeleteOutline, contentDescription = "Удалить", tint = colors.danger)
          }
        }
      }

      OutlinedTextField(
        value = title,
        onValueChange = { title = it },
        label = { Text("Название") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
      )

      // Kind chips
      LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(TaskKind.entries) { k ->
          FilterChip(selected = kind == k, onClick = { kind = k }, label = { Text(k.shortLabel) })
        }
      }

      // Subject chips
      if (subjects.isNotEmpty()) {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          item {
            FilterChip(selected = subjectId == null, onClick = { subjectId = null }, label = { Text("Без предмета") })
          }
          items(subjects, key = { it.id }) { s ->
            FilterChip(
              selected = subjectId == s.id,
              onClick = { subjectId = s.id },
              label = { Text("${s.emoji} ${s.name}") },
            )
          }
        }
      }

      // Due date + time
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        val label = dueDate?.let { DateHelpers.formatDueShort(DateHelpers.formatIsoDate(it)).first } ?: "Без срока"
        OutlinedButton(
          onClick = { showDatePicker = true },
          shape = RoundedCornerShape(12.dp),
          modifier = Modifier.weight(1f),
        ) {
          Icon(Icons.Rounded.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
          Spacer(modifier = Modifier.width(6.dp))
          Text(label, maxLines = 1)
        }
        OutlinedTextField(
          value = dueTime,
          onValueChange = { if (it.length <= 5) dueTime = it },
          label = { Text("Время") },
          placeholder = { Text("18:00") },
          singleLine = true,
          modifier = Modifier.width(120.dp),
        )
      }

      // Priority
      LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(TaskPriority.entries) { p ->
          FilterChip(selected = priority == p, onClick = { priority = p }, label = { Text(p.label) })
        }
      }

      OutlinedTextField(
        value = description,
        onValueChange = { description = it },
        label = { Text("Описание") },
        minLines = 2,
        maxLines = 4,
        modifier = Modifier.fillMaxWidth(),
      )

      Button(
        onClick = {
          val validTime = dueTime.trim().takeIf { Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(it) }
          onSaveEdits(
            title.trim(),
            description.trim().ifBlank { null },
            subjectId,
            dueDate?.let { DateHelpers.formatIsoDate(it) },
            validTime,
            priority.wire,
            kind.wire,
          )
          onDismiss()
        },
        enabled = title.trim().isNotEmpty(),
        modifier = Modifier
          .fillMaxWidth()
          .height(46.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
      ) {
        Text("Сохранить изменения", color = Color.White)
      }

      HorizontalDivider(color = colors.line)

      // Subtasks section
      val doneCount = task.subtasks.count { it.status == "DONE" }
      Text(
        text = "Подзадачи ($doneCount/${task.subtasks.size})",
        style = MaterialTheme.typography.titleMedium,
        color = colors.fg,
      )

      task.subtasks.forEach { st ->
        val stDone = st.status == "DONE"
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(colors.subtle.copy(alpha = 0.7f))
            .clickable { onToggleSubtask(st.id) }
            .padding(horizontal = 12.dp, vertical = 9.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Box(
            modifier = Modifier
              .size(20.dp)
              .clip(CircleShape)
              .background(if (stDone) colors.accent else Color.Transparent)
              .border(1.5.dp, if (stDone) colors.accent else colors.muted, CircleShape),
            contentAlignment = Alignment.Center,
          ) {
            if (stDone) {
              Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp))
            }
          }
          Spacer(modifier = Modifier.width(10.dp))
          Text(
            text = st.title,
            style = MaterialTheme.typography.bodyMedium,
            color = if (stDone) colors.muted else colors.fg,
            textDecoration = if (stDone) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.weight(1f),
          )
          IconButton(onClick = { onDeleteSubtask(st.id) }, modifier = Modifier.size(28.dp)) {
            Icon(
              Icons.Rounded.DeleteOutline,
              contentDescription = "Удалить этап",
              tint = colors.muted,
              modifier = Modifier.size(17.dp),
            )
          }
        }
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        OutlinedTextField(
          value = newSubtaskTitle,
          onValueChange = { newSubtaskTitle = it },
          placeholder = { Text("Добавить этап…") },
          singleLine = true,
          modifier = Modifier.weight(1f),
        )
        Button(
          onClick = {
            if (newSubtaskTitle.trim().isNotEmpty()) {
              onAddSubtask(newSubtaskTitle.trim())
              newSubtaskTitle = ""
            }
          },
          shape = RoundedCornerShape(12.dp),
          colors = ButtonDefaults.buttonColors(containerColor = colors.accent),
        ) {
          Icon(Icons.Rounded.Add, contentDescription = "Добавить", tint = Color.White)
        }
      }

      if (attachments.isNotEmpty() || onUploadFile != null) {
        val taskContext = androidx.compose.ui.platform.LocalContext.current
        val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
          if (uri != null && onUploadFile != null) {
            readPickedUriBytes(taskContext, uri)?.let { (name, mime, bytes) ->
              onUploadFile(name, mime, bytes)
            }
          }
        }
        HorizontalDivider(color = colors.line)
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            text = "Файлы (${attachments.size})",
            style = MaterialTheme.typography.titleMedium,
            color = colors.fg,
          )
          if (onUploadFile != null) {
            FilledTonalButton(
              onClick = { filePicker.launch(arrayOf("*/*")) },
              enabled = !isUploading,
              shape = RoundedCornerShape(10.dp),
            ) {
              Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(modifier = Modifier.width(4.dp))
              Text("Файл")
            }
          }
        }
        if (isUploading) {
          LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = colors.accent)
        }
        attachments.forEach { file ->
          AttachmentRowItem(
            attachment = file,
            isCached = isAttachmentCached(file),
            isBusy = busyAttachmentId == file.id,
            onOpen = { onOpenAttachment(file) },
            onDelete = if (onDeleteAttachment != null) ({ onDeleteAttachment(file.id) }) else null,
          )
        }
      }

      Spacer(modifier = Modifier.height(14.dp))
    }
  }

  if (showDatePicker) {
    val pickerState = rememberDatePickerState(
      initialSelectedDateMillis = dueDate?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
    )
    DatePickerDialog(
      onDismissRequest = { showDatePicker = false },
      confirmButton = {
        TextButton(
          onClick = {
            pickerState.selectedDateMillis?.let { millis ->
              dueDate = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
            }
            showDatePicker = false
          },
        ) { Text("ОК") }
      },
      dismissButton = {
        Row {
          TextButton(onClick = { dueDate = null; showDatePicker = false }) { Text("Убрать") }
          TextButton(onClick = { showDatePicker = false }) { Text("Отмена") }
        }
      },
    ) {
      DatePicker(state = pickerState)
    }
  }

  if (confirmDelete) {
    AlertDialog(
      onDismissRequest = { confirmDelete = false },
      title = { Text("Удалить задачу?") },
      text = { Text("Задача «${task.title}» будет удалена локально и на сервере.") },
      confirmButton = {
        TextButton(
          onClick = {
            confirmDelete = false
            onDelete()
            onDismiss()
          },
        ) {
          Text("Удалить", color = colors.danger)
        }
      },
      dismissButton = {
        TextButton(onClick = { confirmDelete = false }) { Text("Отмена") }
      },
    )
  }
}
