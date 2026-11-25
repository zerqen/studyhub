package ru.studyhub.app.data

import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class SrsState(
  val interval: Int,
  val ease: Double,
  val reps: Int,
  val lapses: Int,
)

/**
 * Exact 1:1 Kotlin port of StudyHub's SM-2 spaced repetition engine (src/lib/srs.ts)
 * and lesson-type filter (src/lib/schedule.ts).
 */
object SrsEngine {
  const val LEARNED_INTERVAL = 7
  private const val MIN_EASE = 1.3
  private const val MAX_EASE = 3.0

  private val lessonKinds = setOf("LECTURE", "SEMINAR", "LAB", "CONSULT")

  fun isLessonKind(kind: String?): Boolean = kind != null && kind in lessonKinds

  fun schedule(prev: SrsState, grade: Int): SrsState {
    var interval = prev.interval
    var ease = prev.ease
    val reps = prev.reps
    val lapses = prev.lapses

    if (grade == 0) {
      val nextEase = ((max(MIN_EASE, ease - 0.2)) * 100.0).roundToInt() / 100.0
      return SrsState(
        interval = 0,
        ease = nextEase,
        reps = 0,
        lapses = lapses + 1,
      )
    }

    if (grade == 1) ease = max(MIN_EASE, ease - 0.15)
    if (grade == 3) ease = min(MAX_EASE, ease + 0.15)

    interval = when {
      reps == 0 -> if (grade == 3) 3 else 1
      reps == 1 -> when (grade) {
        1 -> 2
        2 -> 3
        else -> 5
      }
      else -> {
        val mult = when (grade) {
          1 -> 1.2
          2 -> ease
          else -> ease * 1.3
        }
        max(interval + 1, (interval * mult).roundToInt())
      }
    }

    return SrsState(
      interval = min(interval, 365),
      ease = (ease * 100.0).roundToInt() / 100.0,
      reps = reps + 1,
      lapses = lapses,
    )
  }

  fun dueDate(state: SrsState, now: Instant = Instant.now()): Instant {
    if (state.interval == 0) return now.plus(10, ChronoUnit.MINUTES)
    return now.plus(state.interval.toLong(), ChronoUnit.DAYS).truncatedTo(ChronoUnit.DAYS)
  }

  fun statusFor(state: SrsState, grade: Int): String {
    if (grade == 0) return "REVIEW"
    return if (state.interval >= LEARNED_INTERVAL) "LEARNED" else "IN_PROGRESS"
  }

  fun whenLabel(prev: SrsState, grade: Int): String {
    val n = schedule(prev, grade).interval
    if (n == 0) return "снова через 10 мин"
    if (n < 30) {
      val a = n % 10
      val b = n % 100
      val word = when {
        a == 1 && b != 11 -> "день"
        a in 2..4 && b !in 12..14 -> "дня"
        else -> "дней"
      }
      return "через $n $word"
    }
    if (n < 365) return "через ${(n / 30.0).roundToInt()} мес."
    return "через год"
  }

  fun isDue(srsDueIso: String?, now: Instant = Instant.now()): Boolean {
    if (srsDueIso.isNullOrBlank()) return true
    val parsed = runCatching { Instant.parse(srsDueIso) }.getOrNull() ?: return true
    return !parsed.isAfter(now)
  }
}
