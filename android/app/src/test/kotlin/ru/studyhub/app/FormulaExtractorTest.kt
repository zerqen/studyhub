package ru.studyhub.app

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.studyhub.app.data.FormulaExtractor
import ru.studyhub.app.data.LectureDto
import ru.studyhub.app.data.QuestionDto

class FormulaExtractorTest {
  @Test
  fun extractsRelationsAndBlockFormulasWithoutDuplicates() {
    val md = """
      Пусть ${'$'}x${'$'} — переменная, а ${'$'}E = mc^2${'$'} и ${'$'}E=mc^2${'$'}.
      Интеграл:
      ${'$'}${'$'}
      \int_0^1 x\,dx = \frac{1}{2}
      ${'$'}${'$'}
    """.trimIndent()
    val extracted = FormulaExtractor.extractFormulas(md)
    assertEquals(listOf("E = mc^2", "\\int_0^1 x\\,dx = \\frac{1}{2}"), extracted)
  }

  @Test
  fun buildsSheetDeduplicatingSummaryAgainstQuestionAnswers() {
    val lectures = listOf(
      LectureDto(
        id = "l1",
        subjectId = "s1",
        number = 1,
        title = "Пределы",
        summary = "Формулы: ${'$'}a + b = c${'$'} и ${'$'}${'$'}\\lim_{x\\to 0}\\frac{\\sin x}{x}=1${'$'}${'$'}",
      ),
    )
    val questions = listOf(
      QuestionDto(
        id = "q1",
        subjectId = "s1",
        text = "Первый замечательный предел",
        answer = "${'$'}${'$'}\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1${'$'}${'$'}",
        lectureTitle = "Лекция 1: Пределы",
      ),
      QuestionDto(
        id = "q2",
        subjectId = "s1",
        text = "Задача на дом",
        answer = "${'$'}y = kx + b${'$'}",
        kind = "PROBLEM",
      ),
    )

    val groups = FormulaExtractor.buildFormulaSheet(lectures, questions)
    assertEquals(1, groups.size)
    assertEquals("Лекция 1. Пределы", groups[0].title)
    // Summary formula deduplicates the limit already present in q1, keeping only "a + b = c"
    assertEquals(2, groups[0].entries.size)
    assertEquals(listOf("a + b = c"), groups[0].entries[1].formulas)
  }
}
