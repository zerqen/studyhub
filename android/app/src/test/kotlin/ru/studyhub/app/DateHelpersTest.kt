package ru.studyhub.app

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.studyhub.app.data.DateHelpers
import ru.studyhub.app.data.TaskDto

class DateHelpersTest {

  @Test
  fun subjectShortMatchesWebMonograms() {
    assertEquals("ЛА", DateHelpers.subjectShort("Линейная алгебра"))
    assertEquals("ФИ", DateHelpers.subjectShort("Физика"))
    assertEquals("МА", DateHelpers.subjectShort("Основы математического анализа"))
  }

  @Test
  fun inDaysRuFormatsRussianPlurals() {
    assertEquals("сегодня", DateHelpers.inDaysRu(0))
    assertEquals("завтра", DateHelpers.inDaysRu(1))
    assertEquals("через 2 дня", DateHelpers.inDaysRu(2))
    assertEquals("через 5 дней", DateHelpers.inDaysRu(5))
    assertEquals("через 21 день", DateHelpers.inDaysRu(21))
    assertEquals("через 11 дней", DateHelpers.inDaysRu(11))
  }

  @Test
  fun buildWeekGroupsPlacesOverdueFirstAndMergesWeekend() {
    val wednesday = LocalDate.of(2026, 11, 25)
    val tasks = listOf(
      TaskDto(id = "1", title = "Старое ДЗ", dueDate = "2026-11-23T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "2", title = "Сегодня", dueDate = "2026-11-25T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "3", title = "Суббота", dueDate = "2026-11-28T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "4", title = "Воскресенье", dueDate = "2026-11-29T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "5", title = "Готово", dueDate = "2026-11-25T00:00:00.000Z", status = "DONE"),
    )

    val groups = DateHelpers.buildWeekGroups(tasks, from = wednesday)
    assertEquals(3, groups.size)
    assertEquals("overdue", groups[0].key)
    assertTrue(groups[0].urgent)
    assertEquals("Сегодня", groups[1].label)
    assertEquals("Выходные", groups[2].label)
    assertEquals(2, groups[2].items.size)
    assertFalse(groups[2].urgent)
  }

  @Test
  fun nearestDeadlinesOrdersOverdueBeforeFutureAndSkipsDone() {
    val tasks = listOf(
      TaskDto(id = "a", title = "Без срока", dueDate = null, status = "PLANNED"),
      TaskDto(id = "b", title = "Позже", dueDate = "2026-11-30T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "c", title = "Раньше", dueDate = "2026-11-24T00:00:00.000Z", status = "PLANNED"),
      TaskDto(id = "d", title = "Сделано", dueDate = "2026-11-20T00:00:00.000Z", status = "DONE"),
    )
    val ordered = DateHelpers.nearestDeadlines(tasks, limit = 5)
    assertEquals(listOf("c", "b", "a"), ordered.map { it.id })
  }
}
