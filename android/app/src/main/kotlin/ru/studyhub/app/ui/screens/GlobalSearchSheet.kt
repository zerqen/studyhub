package ru.studyhub.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.FilesViewHelper
import ru.studyhub.app.data.LectureDto
import ru.studyhub.app.data.NoteDto
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.ui.components.AttachmentRowItem
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.TaskRowItem
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalSearchSheet(
  snapshot: StudyHubSnapshot,
  busyAttachmentId: String? = null,
  isAttachmentCached: (AttachmentDto) -> Boolean = { false },
  onDismiss: () -> Unit,
  onOpenSubject: (String) -> Unit,
  onToggleTask: (String) -> Unit,
  onOpenTask: (TaskDto) -> Unit,
  onOpenNote: (NoteDto) -> Unit,
  onOpenLecture: (LectureDto) -> Unit,
  onOpenAttachment: (AttachmentDto) -> Unit = {},
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var query by rememberSaveable { mutableStateOf("") }
  val subjectsById = remember(snapshot.subjects) { snapshot.subjects.associateBy { it.id } }
  val q = query.trim().lowercase()

  val matchedSubjects = remember(snapshot.subjects, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.subjects.filter { it.name.lowercase().contains(q) }.take(6)
  }
  val matchedTasks = remember(snapshot.tasks, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.tasks.filter {
      it.status != "CANCELLED" &&
        (it.title.lowercase().contains(q) || (it.description?.lowercase()?.contains(q) == true))
    }.take(10)
  }
  val matchedNotes = remember(snapshot.notes, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.notes.filter {
      it.title.lowercase().contains(q) || it.content.lowercase().contains(q)
    }.take(10)
  }
  val matchedLectures = remember(snapshot.lectures, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.lectures.filter {
      it.title.lowercase().contains(q) || it.summary.lowercase().contains(q)
    }.take(10)
  }
  val matchedQuestions = remember(snapshot.questions, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.questions.filter {
      it.text.lowercase().contains(q) || (it.answer?.lowercase()?.contains(q) == true)
    }.take(10)
  }
  val matchedFiles = remember(snapshot.attachments, q) {
    if (q.isEmpty()) emptyList()
    else snapshot.attachments.filter { FilesViewHelper.matchFile(q, it) }.take(10)
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.bg,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .fillMaxHeight(0.92f)
        .imePadding()
        .padding(horizontal = 16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text("Поиск оффлайн", style = MaterialTheme.typography.headlineMedium, color = colors.fg)
        IconButton(onClick = onDismiss) {
          Icon(Icons.Rounded.Close, contentDescription = "Закрыть")
        }
      }

      OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        placeholder = { Text("Задачи, заметки, лекции, вопросы…") },
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

      LazyColumn(
        modifier = Modifier.weight(1f),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        if (q.isEmpty()) {
          item {
            StudyCard {
              Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Мгновенный поиск по всему StudyHub", style = MaterialTheme.typography.titleMedium, color = colors.fg)
                Text(
                  text = "Ищет локально по ${snapshot.tasks.size} задачам, ${snapshot.notes.size} заметкам, ${snapshot.lectures.size} лекциям, ${snapshot.questions.size} вопросам и ${snapshot.attachments.size} файлам.",
                  style = MaterialTheme.typography.bodyMedium,
                  color = colors.muted,
                )
              }
            }
          }
        } else if (
          matchedSubjects.isEmpty() &&
          matchedTasks.isEmpty() &&
          matchedNotes.isEmpty() &&
          matchedLectures.isEmpty() &&
          matchedQuestions.isEmpty() &&
          matchedFiles.isEmpty()
        ) {
          item {
            StudyCard {
              Column(modifier = Modifier.padding(20.dp)) {
                Text("По запросу «$query» ничего не найдено", style = MaterialTheme.typography.bodyLarge, color = colors.muted)
              }
            }
          }
        } else {
          if (matchedSubjects.isNotEmpty()) {
            item { Text("Предметы (${matchedSubjects.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            items(matchedSubjects, key = { "s_${it.id}" }) { s ->
              Surface(
                onClick = {
                  onDismiss()
                  onOpenSubject(s.id)
                },
                shape = RoundedCornerShape(12.dp),
                color = colors.surface,
                border = BorderStroke(1.dp, colors.line),
                modifier = Modifier.fillMaxWidth(),
              ) {
                Row(
                  modifier = Modifier.padding(12.dp),
                  horizontalArrangement = Arrangement.spacedBy(10.dp),
                  verticalAlignment = Alignment.CenterVertically,
                ) {
                  Text(s.emoji)
                  Text(
                    text = s.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = parseHexColor(s.color, colors.accent),
                  )
                }
              }
            }
          }

          if (matchedTasks.isNotEmpty()) {
            item { Text("Задачи (${matchedTasks.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            item {
              StudyCard {
                matchedTasks.forEachIndexed { idx, t ->
                  TaskRowItem(
                    task = t,
                    subject = t.subjectId?.let { subjectsById[it] },
                    onToggleDone = { onToggleTask(t.id) },
                    onClick = {
                      onDismiss()
                      onOpenTask(t)
                    },
                  )
                  if (idx < matchedTasks.lastIndex) {
                    HorizontalDivider(color = colors.line.copy(alpha = 0.65f), modifier = Modifier.padding(start = 48.dp))
                  }
                }
              }
            }
          }

          if (matchedNotes.isNotEmpty()) {
            item { Text("Заметки (${matchedNotes.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            items(matchedNotes, key = { "n_${it.id}" }) { note ->
              NoteListCard(
                note = note,
                subject = note.subjectId?.let { subjectsById[it] },
                onClick = {
                  onDismiss()
                  onOpenNote(note)
                },
              )
            }
          }

          if (matchedLectures.isNotEmpty()) {
            item { Text("Лекции (${matchedLectures.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            items(matchedLectures, key = { "l_${it.id}" }) { lecture ->
              LectureListCard(
                lecture = lecture,
                subject = subjectsById[lecture.subjectId],
                onClick = {
                  onDismiss()
                  onOpenLecture(lecture)
                },
              )
            }
          }

          if (matchedQuestions.isNotEmpty()) {
            item { Text("Вопросы (${matchedQuestions.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            items(matchedQuestions, key = { "q_${it.id}" }) { question ->
              ExpandableQuestionCard(question = question)
            }
          }

          if (matchedFiles.isNotEmpty()) {
            item { Text("Файлы (${matchedFiles.size})", style = MaterialTheme.typography.labelLarge, color = colors.muted) }
            items(matchedFiles, key = { "f_${it.id}" }) { att ->
              AttachmentRowItem(
                attachment = att,
                isCached = isAttachmentCached(att),
                isBusy = busyAttachmentId == att.id,
                onOpen = { onOpenAttachment(att) },
              )
            }
          }
        }
        item { Spacer(modifier = Modifier.height(16.dp)) }
      }
    }
  }
}
