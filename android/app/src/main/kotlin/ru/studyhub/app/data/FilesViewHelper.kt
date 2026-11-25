package ru.studyhub.app.data

import java.time.Instant
import java.util.Locale

enum class FileKind(val label: String) {
  ALL("Все"),
  PDF("PDF"),
  DOCS("Документы"),
  IMAGES("Фото"),
  AUDIO("Аудио"),
  ZIP("Архивы"),
}

enum class FileSort(val label: String) {
  NEW("Новые"),
  NAME("Имя"),
  SIZE("Размер"),
}

data class FileFolder(
  val id: String,
  val label: String,
  val colorHex: String?,
  val selfStudy: Boolean,
  val count: Int,
)

/**
 * 1:1 Kotlin port of src/lib/files-view.ts for browsing, filtering, and searching
 * all user files offline in Android.
 */
object FilesViewHelper {
  private val ruLocale = Locale.forLanguageTag("ru-RU")
  private val docExtRe = Regex("\\.(docx?|xlsx?|pptx?|odt|ods|rtf|txt|csv|md)$", RegexOption.IGNORE_CASE)
  private val zipExtRe = Regex("\\.(zip|rar|7z|tar|gz)$", RegexOption.IGNORE_CASE)
  private val audioExtRe = Regex("\\.(mp3|m4a|wav|ogg|aac|flac|webm|opus)$", RegexOption.IGNORE_CASE)

  fun kindOf(name: String, mimeType: String): FileKind {
    val lowMime = mimeType.lowercase(Locale.US)
    return when {
      lowMime == "application/pdf" || name.endsWith(".pdf", ignoreCase = true) -> FileKind.PDF
      lowMime.startsWith("image/") -> FileKind.IMAGES
      lowMime.startsWith("audio/") || audioExtRe.containsMatchIn(name) -> FileKind.AUDIO
      lowMime.contains("zip") || lowMime.contains("rar") || lowMime.contains("7z") ||
        lowMime.contains("tar") || lowMime.contains("gzip") || zipExtRe.containsMatchIn(name) -> FileKind.ZIP
      docExtRe.containsMatchIn(name) || lowMime.contains("word") ||
        lowMime.contains("sheet") || lowMime.contains("presentation") ||
        lowMime.startsWith("text/") -> FileKind.DOCS
      else -> FileKind.ALL
    }
  }

  fun extBadge(name: String): String {
    val idx = name.lastIndexOf('.')
    return if (idx > 0 && idx < name.lastIndex) {
      name.substring(idx + 1).uppercase(Locale.US).take(4)
    } else {
      "ФАЙЛ"
    }
  }

  fun isRecent(createdAtIso: String, nowMillis: Long = System.currentTimeMillis()): Boolean {
    val ms = runCatching { Instant.parse(createdAtIso).toEpochMilli() }.getOrNull() ?: return false
    return (nowMillis - ms) in 0L..(7L * 86_400_000L)
  }

  fun matchFile(query: String, att: AttachmentDto): Boolean {
    val words = query.lowercase(ruLocale).replace('ё', 'е')
      .split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (words.isEmpty()) return true
    val hay = "${att.originalName}\n${att.whereLabel}\n${att.folderName}"
      .lowercase(ruLocale).replace('ё', 'е')
    return words.all { hay.contains(it) }
  }

  fun buildFolders(
    attachments: List<AttachmentDto>,
    subjects: List<SubjectDto>,
  ): List<FileFolder> {
    val subjectsById = subjects.associateBy { it.id }
    val grouped = linkedMapOf<String, MutableList<AttachmentDto>>()
    for (att in attachments) {
      val fid = att.folder.ifBlank { "loose" }
      if (fid == "loose") continue
      grouped.getOrPut(fid) { mutableListOf() }.add(att)
    }
    return grouped.entries.map { (fid, list) ->
      val sample = list.first()
      val sub = subjectsById[fid]
      FileFolder(
        id = fid,
        label = sub?.name ?: sample.folderName.ifBlank { "Предмет" },
        colorHex = sub?.color ?: sample.folderColor,
        selfStudy = sample.folderSelfStudy,
        count = list.size,
      )
    }.sortedWith(compareBy<FileFolder> { it.selfStudy }.thenBy { it.label.lowercase(ruLocale) })
  }

  fun filterAndSort(
    attachments: List<AttachmentDto>,
    folderId: String,
    kind: FileKind,
    sort: FileSort,
    query: String,
    nowMillis: Long = System.currentTimeMillis(),
  ): List<AttachmentDto> {
    val searching = query.isNotBlank()
    var list = if (searching) {
      attachments.filter { matchFile(query, it) }
    } else {
      when (folderId) {
        "all" -> attachments
        "recent" -> attachments.filter { isRecent(it.createdAt, nowMillis) }
        "loose" -> attachments.filter { it.folder == "loose" }
        else -> attachments.filter { it.folder == folderId || it.subjectId == folderId }
      }
    }
    if (kind != FileKind.ALL) {
      list = list.filter { kindOf(it.originalName, it.mimeType) == kind }
    }
    return when (sort) {
      FileSort.NEW -> list.sortedByDescending { it.createdAt }
      FileSort.NAME -> list.sortedBy { it.originalName.lowercase(ruLocale) }
      FileSort.SIZE -> list.sortedByDescending { it.size }
    }
  }
}
