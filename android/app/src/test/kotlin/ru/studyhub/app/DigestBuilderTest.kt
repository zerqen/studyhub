package ru.studyhub.app

import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.StudyHubSnapshot
import ru.studyhub.app.data.SubjectDto
import ru.studyhub.app.data.TaskDto
import ru.studyhub.app.data.TodayEventDto
import ru.studyhub.app.notifications.DigestBuilder

class DigestBuilderTest {

  @Test
  fun morningDigestRespectsShowLessonsFlagAndCountsDeadlines() {
    val today = LocalDate.of(2026, 11, 25)
    val snap = StudyHubSnapshot(
      subjects = listOf(SubjectDto(id = "s1", name = "Физика", examDate = "2026-11-27T00:00:00.000Z")),
      tasks = listOf(
        TaskDto(id = "t1", title = "ДЗ 1", kind = "HOMEWORK", dueDate = "2026-11-25T00:00:00.000Z", status = "PLANNED"),
        TaskDto(id = "t2", title = "Старое", kind = "TASK", dueDate = "2026-11-23T00:00:00.000Z", status = "PLANNED"),
      ),
      todayEvents = listOf(
        TodayEventDto(key = "e1", title = "Лекция по физике", kind = "LECTURE", start = "2026-11-25T06:00:00Z"),
      ),
      questions = listOf(
        QuestionDto(id = "q1", subjectId = "s1", text = "Q1", srsReps = 1, srsDue = "2026-11-24T00:00:00Z"),
      ),
    )

    val hiddenLessons = DigestBuilder.buildMorning(snap, showLessons = false, today = today)
    assertNotNull(hiddenLessons)
    assertFalse(hiddenLessons!!.body.contains("Первая пара"))
    assertTrue(hiddenLessons.body.contains("Просрочено: 1"))
    assertTrue(hiddenLessons.body.contains("сдать 1 домашку"))
    assertTrue(hiddenLessons.body.contains("1 карточка к повтору"))
    assertTrue(hiddenLessons.body.contains("Через 2 дня экзамен: Физика"))

    val shownLessons = DigestBuilder.buildMorning(snap, showLessons = true, today = today)
    assertTrue(shownLessons!!.body.contains("Первая пара:"))
  }

  @Test
  fun eveningDigestReturnsNullWhenNothingScheduledAndFormatsTomorrowHomework() {
    val today = LocalDate.of(2026, 11, 25)
    assertNull(DigestBuilder.buildEvening(StudyHubSnapshot(), showLessons = false, today = today))

    val snap = StudyHubSnapshot(
      subjects = listOf(SubjectDto(id = "s1", name = "Матан")),
      tasks = listOf(
        TaskDto(
          id = "t1",
          title = "Номера 1-5",
          subjectId = "s1",
          kind = "HOMEWORK",
          dueDate = "2026-11-26T00:00:00.000Z",
          status = "PLANNED",
        ),
      ),
    )
    val evening = DigestBuilder.buildEvening(snap, showLessons = false, today = today)
    assertNotNull(evening)
    assertEquals("На завтра 1 домашка", evening!!.title)
    assertTrue(evening.body.contains("ДЗ · Матан: Номера 1-5"))
  }

  @Test
  fun delayUntilNextMillisSchedulesTodayOrTomorrowCorrectly() {
    val zone = ZoneId.of("Europe/Moscow")
    val morningNow = ZonedDateTime.of(2026, 11, 25, 7, 0, 0, 0, zone)
    val delaySameDay = DigestBuilder.delayUntilNextMillis(8, 0, morningNow)
    assertEquals(3_600_000L, delaySameDay)

    val eveningNow = ZonedDateTime.of(2026, 11, 25, 9, 0, 0, 0, zone)
    val delayNextDay = DigestBuilder.delayUntilNextMillis(8, 0, eveningNow)
    assertEquals(23 * 3_600_000L, delayNextDay)
  }
}
