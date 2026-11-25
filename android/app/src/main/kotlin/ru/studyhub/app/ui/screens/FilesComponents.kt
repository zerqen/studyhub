package ru.studyhub.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Functions
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.FileFolder
import ru.studyhub.app.data.FileKind
import ru.studyhub.app.data.FileSort
import ru.studyhub.app.data.FilesViewHelper
import ru.studyhub.app.data.FormulaExtractor
import ru.studyhub.app.data.LectureDto
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.ui.components.KaTeXMarkdownView
import ru.studyhub.app.ui.components.StudyCard
import ru.studyhub.app.ui.components.formatBytes
import ru.studyhub.app.ui.components.parseHexColor
import ru.studyhub.app.ui.theme.StudyHubThemeColors

@Composable
fun FilesBrowserControls(
  query: String,
  onQueryChange: (String) -> Unit,
  selectedFolder: String,
  onSelectFolder: (String) -> Unit,
  recentCount: Int,
  totalCount: Int,
  looseCount: Int,
  folders: List<FileFolder>,
  selectedKind: FileKind,
  onSelectKind: (FileKind) -> Unit,
  selectedSort: FileSort,
  onSelectSort: (FileSort) -> Unit,
  uploadLabel: String,
  isUploading: Boolean,
  onPickUpload: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        placeholder = { Text("Поиск по всем файлам…", maxLines = 1, overflow = TextOverflow.Ellipsis) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
        trailingIcon = {
          if (query.isNotEmpty()) {
            IconButton(onClick = { onQueryChange("") }) {
              Icon(Icons.Rounded.Close, contentDescription = "Очистить")
            }
          }
        },
        modifier = Modifier.weight(1f),
      )
      FilledTonalButton(
        onClick = onPickUpload,
        enabled = !isUploading,
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp),
      ) {
        Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(4.dp))
        Text(uploadLabel, maxLines = 1)
      }
    }

    if (isUploading) {
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = colors.accent)
        Text("Загружаем файл на сервер…", style = MaterialTheme.typography.labelMedium, color = colors.muted)
      }
    }

    if (query.isBlank()) {
      LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
          FilterChip(
            selected = selectedFolder == "recent",
            onClick = { onSelectFolder("recent") },
            label = { Text("Недавние ($recentCount)") },
          )
        }
        item {
          FilterChip(
            selected = selectedFolder == "all",
            onClick = { onSelectFolder("all") },
            label = { Text("Все ($totalCount)") },
          )
        }
        items(folders, key = { it.id }) { folder ->
          val dotColor = parseHexColor(folder.colorHex, colors.accent)
          FilterChip(
            selected = selectedFolder == folder.id,
            onClick = { onSelectFolder(folder.id) },
            leadingIcon = {
              Box(
                modifier = Modifier
                  .size(8.dp)
                  .clip(RoundedCornerShape(2.dp))
                  .background(dotColor),
              )
            },
            label = { Text("${folder.label} (${folder.count})") },
          )
        }
        if (looseCount > 0) {
          item {
            FilterChip(
              selected = selectedFolder == "loose",
              onClick = { onSelectFolder("loose") },
              label = { Text("Без места ($looseCount)") },
            )
          }
        }
      }
    }

    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      items(FileKind.entries) { k ->
        FilterChip(
          selected = selectedKind == k,
          onClick = { onSelectKind(k) },
          label = { Text(k.label) },
        )
      }
    }

    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      items(FileSort.entries) { s ->
        FilterChip(
          selected = selectedSort == s,
          onClick = { onSelectSort(s) },
          label = { Text("Сорт: ${s.label}") },
        )
      }
    }
  }
}

@Composable
fun FileBrowserRow(
  attachment: AttachmentDto,
  isCached: Boolean,
  isBusy: Boolean,
  showFolderBadge: Boolean = true,
  onOpen: () -> Unit,
  onJumpToSource: (() -> Unit)? = null,
  onDelete: (() -> Unit)? = null,
) {
  val colors = StudyHubThemeColors.current
  val kind = FilesViewHelper.kindOf(attachment.originalName, attachment.mimeType)
  val badge = FilesViewHelper.extBadge(attachment.originalName)
  val badgeTint = when (kind) {
    FileKind.PDF -> colors.urgent
    FileKind.IMAGES -> colors.success
    FileKind.AUDIO -> colors.accent
    FileKind.ZIP -> colors.warning
    else -> parseHexColor(attachment.folderColor, colors.accent)
  }

  Surface(
    onClick = onOpen,
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = colors.surface,
    border = BorderStroke(1.dp, colors.line),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Box(
        modifier = Modifier
          .size(width = 46.dp, height = 34.dp)
          .clip(RoundedCornerShape(8.dp))
          .background(badgeTint.copy(alpha = 0.14f)),
        contentAlignment = Alignment.Center,
      ) {
        if (isBusy) {
          CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = badgeTint)
        } else {
          Text(
            text = badge,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = badgeTint,
            maxLines = 1,
          )
        }
      }

      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
          text = attachment.originalName,
          style = MaterialTheme.typography.bodyMedium,
          fontWeight = FontWeight.Medium,
          color = colors.fg,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        val whereText = buildString {
          if (showFolderBadge && attachment.folder != "loose" && attachment.folderName.isNotBlank()) {
            append(attachment.folderName)
            append(" · ")
          }
          append(attachment.whereLabel)
        }
        Text(
          text = whereText,
          style = MaterialTheme.typography.labelSmall,
          color = colors.muted,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        val metaText = buildString {
          append(formatBytes(attachment.size))
          if (attachment.createdAt.isNotBlank()) {
            append(" · ")
            append(DateHelpers.formatShortDate(attachment.createdAt))
          }
          if (isCached) append(" · Оффлайн")
        }
        Text(
          text = metaText,
          style = MaterialTheme.typography.labelSmall,
          color = if (isCached) colors.success else colors.muted,
          maxLines = 1,
        )
      }

      if (onJumpToSource != null) {
        IconButton(onClick = onJumpToSource, modifier = Modifier.size(34.dp)) {
          Icon(
            Icons.AutoMirrored.Rounded.OpenInNew,
            contentDescription = "Открыть источник",
            tint = colors.accent,
            modifier = Modifier.size(18.dp),
          )
        }
      }

      if (onDelete != null) {
        IconButton(onClick = onDelete, modifier = Modifier.size(34.dp)) {
          Icon(
            Icons.Rounded.DeleteOutline,
            contentDescription = "Удалить файл",
            tint = colors.muted,
            modifier = Modifier.size(18.dp),
          )
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormulaSheetModal(
  subject: SubjectDto,
  lectures: List<LectureDto>,
  questions: List<QuestionDto>,
  onDismiss: () -> Unit,
) {
  val colors = StudyHubThemeColors.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val groups = remember(lectures, questions) {
    FormulaExtractor.buildFormulaSheet(lectures, questions)
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = colors.bg,
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .navigationBarsPadding()
        .padding(horizontal = 20.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Icon(Icons.Rounded.Functions, contentDescription = null, tint = colors.accent)
        Column(modifier = Modifier.weight(1f)) {
          Text("Лист формул", style = MaterialTheme.typography.headlineMedium, color = colors.fg)
          Text(
            text = "${subject.emoji} ${subject.name} · оффлайн",
            style = MaterialTheme.typography.labelLarge,
            color = colors.muted,
          )
        }
      }

      HorizontalDivider(color = colors.line)

      if (groups.isEmpty()) {
        StudyCard {
          Text(
            text = "Формул по этому предмету пока нет. Они собираются автоматически из LaTeX в ответах на вопросы и конспектах лекций.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.muted,
            modifier = Modifier.padding(16.dp),
          )
        }
      } else {
        groups.forEach { group ->
          StudyCard {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              Text(group.title, style = MaterialTheme.typography.titleMedium, color = colors.accent)
              group.entries.forEach { entry ->
                val md = buildString {
                  append("**")
                  append(entry.title)
                  append("**\n\n")
                  entry.formulas.forEach { f ->
                    append("$$\n")
                    append(f)
                    append("\n$$\n\n")
                  }
                }
                KaTeXMarkdownView(markdown = md, textSizeSp = 15)
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(16.dp))
    }
  }
}
