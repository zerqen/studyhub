package ru.studyhub.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.studyhub.app.data.AttachmentDto
import ru.studyhub.app.data.FileKind
import ru.studyhub.app.data.FileSort
import ru.studyhub.app.data.FilesViewHelper
import ru.studyhub.app.data.SubjectDto

class FilesViewHelperTest {
  private val subjects = listOf(
    SubjectDto(id = "s_math", name = "Матан", color = "#2d5bd2"),
    SubjectDto(id = "s_phy", name = "Физика", color = "#10b981"),
  )

  private val sample = listOf(
    AttachmentDto(
      id = "a1",
      originalName = "Отчёт_лаба.pdf",
      mimeType = "application/pdf",
      size = 500_000L,
      subjectId = "s_phy",
      folder = "s_phy",
      folderName = "Физика",
      whereLabel = "Задача «Лаба 1»",
      createdAt = "2026-11-24T10:00:00.000Z",
    ),
    AttachmentDto(
      id = "a2",
      originalName = "шпора.docx",
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size = 20_000L,
      folder = "loose",
      folderName = "Не прикреплено",
      whereLabel = "Не прикреплено",
      createdAt = "2026-11-10T10:00:00.000Z",
    ),
    AttachmentDto(
      id = "a3",
      originalName = "Запись.m4a",
      mimeType = "audio/mp4",
      size = 3_000_000L,
      lectureId = "lec1",
      folder = "s_math",
      folderName = "Матан",
      whereLabel = "Лекция 2 · Ряды",
      createdAt = "2026-11-25T08:00:00.000Z",
    ),
  )

  @Test
  fun classifiesFileKindsAndBadges() {
    assertEquals(FileKind.PDF, FilesViewHelper.kindOf("test.PDF", "application/octet-stream"))
    assertEquals(FileKind.DOCS, FilesViewHelper.kindOf("notes.docx", "application/octet-stream"))
    assertEquals(FileKind.AUDIO, FilesViewHelper.kindOf("rec.m4a", "audio/mp4"))
    assertEquals("DOCX", FilesViewHelper.extBadge("notes.docx"))
    assertEquals("ФАЙЛ", FilesViewHelper.extBadge("README"))
  }

  @Test
  fun matchesRussianQueriesNormalizingYoAndFilteringFolders() {
    assertTrue(FilesViewHelper.matchFile("отчет лаба", sample[0]))
    assertFalse(FilesViewHelper.matchFile("матан", sample[0]))

    val folders = FilesViewHelper.buildFolders(sample, subjects)
    assertEquals(listOf("s_math", "s_phy"), folders.map { it.id })

    val looseOnly = FilesViewHelper.filterAndSort(sample, "loose", FileKind.ALL, FileSort.NEW, "")
    assertEquals(listOf("a2"), looseOnly.map { it.id })

    val pdfOnly = FilesViewHelper.filterAndSort(sample, "all", FileKind.PDF, FileSort.SIZE, "")
    assertEquals(listOf("a1"), pdfOnly.map { it.id })
  }
}
