package ru.studyhub.app

import java.time.Instant
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.studyhub.app.data.QuestionDto
import ru.studyhub.app.data.SrsEngine
import ru.studyhub.app.data.SrsState

class SrsEngineTest {
  private val fresh = SrsState(interval = 0, ease = 2.5, reps = 0, lapses = 0)

  @Test
  fun firstAndSecondGoodGradesMatchWebSm2() {
    val a = SrsEngine.schedule(fresh, 2)
    assertEquals(1, a.interval)
    val b = SrsEngine.schedule(a, 2)
    assertEquals(3, b.interval)
  }

  @Test
  fun intervalsGrowOnConsistentGoodGrades() {
    var s = fresh
    val intervals = mutableListOf<Int>()
    repeat(6) {
      s = SrsEngine.schedule(s, 2)
      intervals += s.interval
    }
    for (i in 1 until intervals.size) {
      assertTrue(intervals[i] > intervals[i - 1])
    }
  }

  @Test
  fun lapseResetsProgressAndLowersEase() {
    val learned = SrsEngine.schedule(SrsEngine.schedule(SrsEngine.schedule(fresh, 2), 2), 2)
    val lapsed = SrsEngine.schedule(learned, 0)
    assertEquals(0, lapsed.interval)
    assertEquals(0, lapsed.reps)
    assertEquals(1, lapsed.lapses)
    assertTrue(lapsed.ease < learned.ease)
  }

  @Test
  fun easeBoundsAndMaxIntervalAreRespected() {
    var s = fresh
    repeat(30) { s = SrsEngine.schedule(s, 0) }
    assertTrue(s.ease >= 1.3)

    var t = fresh
    repeat(30) { t = SrsEngine.schedule(t, 3) }
    assertTrue(t.ease <= 3.0)
    assertTrue(t.interval <= 365)
  }

  @Test
  fun statusAndDueCalculationsMatchWeb() {
    assertEquals("LEARNED", SrsEngine.statusFor(fresh.copy(interval = SrsEngine.LEARNED_INTERVAL), 2))
    assertEquals("IN_PROGRESS", SrsEngine.statusFor(fresh.copy(interval = 3), 2))
    assertEquals("REVIEW", SrsEngine.statusFor(fresh.copy(interval = 0), 0))

    val now = Instant.parse("2026-10-17T10:00:00Z")
    val lapseDue = SrsEngine.dueDate(fresh.copy(interval = 0), now)
    assertEquals(10 * 60 * 1000L, lapseDue.toEpochMilli() - now.toEpochMilli())

    assertTrue(SrsEngine.isDue(null, now))
    assertTrue(SrsEngine.isDue("2026-10-17T09:00:00Z", now))
    assertFalse(SrsEngine.isDue("2026-10-18T00:00:00Z", now))
  }

  @Test
  fun whenLabelsAndLessonKindFilterWorkCorrectly() {
    assertEquals("снова через 10 мин", SrsEngine.whenLabel(fresh, 0))
    assertEquals("через 1 день", SrsEngine.whenLabel(fresh, 2))
    assertEquals("через 3 дня", SrsEngine.whenLabel(fresh, 3))

    assertTrue(SrsEngine.isLessonKind("LECTURE"))
    assertTrue(SrsEngine.isLessonKind("SEMINAR"))
    assertTrue(SrsEngine.isLessonKind("LAB"))
    assertTrue(SrsEngine.isLessonKind("CONSULT"))
    assertFalse(SrsEngine.isLessonKind("EXAM"))
    assertFalse(SrsEngine.isLessonKind("OTHER"))
    assertFalse(SrsEngine.isLessonKind(null))
  }

  @Test
  fun pickWeakestPrioritizesLapsedAndSkipsProblemsOrEmptyAnswers() {
    val now = Instant.parse("2026-11-25T10:00:00Z")
    val strong = QuestionDto(
      id = "strong",
      subjectId = "s1",
      text = "Strong",
      answer = "Ans",
      status = "LEARNED",
      srsInterval = 30,
      srsEase = 2.6,
      srsReps = 4,
      srsDue = "2026-12-20T00:00:00Z",
    )
    val weak = QuestionDto(
      id = "weak",
      subjectId = "s1",
      text = "Weak",
      answer = "Ans",
      status = "REVIEW",
      srsLapses = 2,
      srsInterval = 0,
      srsEase = 1.8,
      srsReps = 0,
      srsDue = "2026-11-24T00:00:00Z",
    )
    val problem = QuestionDto(
      id = "prob",
      subjectId = "s1",
      text = "Problem",
      answer = "Ans",
      kind = "PROBLEM",
    )
    val noAns = QuestionDto(
      id = "noans",
      subjectId = "s1",
      text = "NoAns",
      answer = "   ",
    )

    val picked = SrsEngine.pickWeakest(listOf(strong, problem, noAns, weak), limit = 10, now = now)
    assertEquals(listOf("weak", "strong"), picked.map { it.id })
  }

  @Test
  fun drawExamTicketGroupsByTicketNoOrPicksRandomTheoryAndProblem() {
    val byTicketQuestions = listOf(
      QuestionDto(id = "q1", subjectId = "s1", text = "Q1", ticketNo = 5, sortOrder = 1),
      QuestionDto(id = "q2", subjectId = "s1", text = "Q2", ticketNo = 5, sortOrder = 2),
    )
    val ticket = SrsEngine.drawExamTicket(byTicketQuestions, "Матан", Random(1))
    assertNotNull(ticket)
    assertEquals("Билет №5", ticket!!.title)
    assertEquals(listOf("q1", "q2"), ticket.items.map { it.id })

    val mixed = listOf(
      QuestionDto(id = "t1", subjectId = "s1", text = "T1", kind = "THEORY"),
      QuestionDto(id = "t2", subjectId = "s1", text = "T2", kind = "THEORY"),
      QuestionDto(id = "p1", subjectId = "s1", text = "P1", kind = "PROBLEM"),
    )
    val randomTicket = SrsEngine.drawExamTicket(mixed, "Физика", Random(1))
    assertNotNull(randomTicket)
    assertEquals("Случайный билет", randomTicket!!.title)
    assertEquals(3, randomTicket.items.size)
  }
}
