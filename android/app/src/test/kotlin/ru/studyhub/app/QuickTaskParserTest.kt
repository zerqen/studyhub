package ru.studyhub.app

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import ru.studyhub.app.data.QuickTaskParser
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskKind

class QuickTaskParserTest {
  private val subjects = listOf(
    SubjectDto(id = "s_mat", name = "Математический анализ"),
    SubjectDto(id = "s_lin", name = "Линейная алгебра"),
    SubjectDto(id = "s_phy", name = "Физика"),
  )

  private val wednesday = LocalDate.of(2026, 11, 25) // Wednesday

  @Test
  fun parsesHomeworkSubjectTomorrowAndTime() {
    val parsed = QuickTaskParser.parse("ДЗ матан завтра 18:00", subjects, wednesday)
    assertEquals(TaskKind.HOMEWORK, parsed.kind)
    assertEquals("s_mat", parsed.subjectId)
    assertEquals("2026-11-26T00:00:00.000Z", parsed.dueDateIso)
    assertEquals("18:00", parsed.dueTime)
  }

  @Test
  fun parsesLabDayMonthAndSubject() {
    val parsed = QuickTaskParser.parse("лаба 3 физика до 5.12", subjects, wednesday)
    assertEquals(TaskKind.LAB, parsed.kind)
    assertEquals("s_phy", parsed.subjectId)
    assertEquals("2026-12-05T00:00:00.000Z", parsed.dueDateIso)
    assertEquals("Лаба 3", parsed.title)
  }

  @Test
  fun parsesControlWorkAndWeekday() {
    val parsed = QuickTaskParser.parse("кр линал в пятницу", subjects, wednesday)
    assertEquals(TaskKind.TEST, parsed.kind)
    assertEquals("s_lin", parsed.subjectId)
    assertEquals("2026-11-27T00:00:00.000Z", parsed.dueDateIso)
    assertNull(parsed.dueTime)
  }

  @Test
  fun parsesDrawingThroughWeek() {
    val parsed = QuickTaskParser.parse("чертёж через неделю", subjects, wednesday)
    assertEquals(TaskKind.DRAWING, parsed.kind)
    assertEquals("2026-12-02T00:00:00.000Z", parsed.dueDateIso)
  }
}
