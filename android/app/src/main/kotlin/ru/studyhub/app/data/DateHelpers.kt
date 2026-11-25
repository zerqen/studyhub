package ru.studyhub.app.data

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

data class TaskDayGroup(
  val key: String,
  val label: String,
  val dateLabel: String,
  val urgent: Boolean,
  val items: List<TaskDto>,
)

object DateHelpers {
  private val ruLocale = Locale("ru", "RU")
  private val moscowZone: ZoneId = ZoneId.of("Europe/Moscow")

  private val dayMonthFmt = DateTimeFormatter.ofPattern("d MMMM", ruLocale)
  private val dayShortMonthFmt = DateTimeFormatter.ofPattern("d MMM", ruLocale)
  private val weekdayShortDateFmt = DateTimeFormatter.ofPattern("EEE, d MMMM", ruLocale)
  private val weekdayFullFmt = DateTimeFormatter.ofPattern("EEEE", ruLocale)
  private val fullDateFmt = DateTimeFormatter.ofPattern("EEEE, d MMMM", ruLocale)
  private val timeFmt = DateTimeFormatter.ofPattern("HH:mm", ruLocale)

  private val shortSkip = setOf(
    "и", "в", "во", "на", "по", "к", "с", "для", "о", "об", "основы", "введение",
  )

  fun today(zone: ZoneId = ZoneId.systemDefault()): LocalDate = LocalDate.now(zone)

  fun parseDateOnly(iso: String?): LocalDate? {
    if (iso.isNullOrBlank()) return null
    return runCatching { LocalDate.parse(iso.take(10)) }.getOrNull()
  }

  fun formatIsoDate(date: LocalDate): String = "${date}T00:00:00.000Z"

  fun greetingRu(now: ZonedDateTime = ZonedDateTime.now()): String {
    val h = now.hour
    return when {
      h < 6 -> "Доброй ночи"
      h < 12 -> "Доброе утро"
      h < 18 -> "Добрый день"
      else -> "Добрый вечер"
    }
  }

  fun studyWeek(date: LocalDate = today()): Int {
    val startYear = if (date.monthValue >= 9) date.year else date.year - 1
    val sept1 = LocalDate.of(startYear, 9, 1)
    val daysSinceMonday = (sept1.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
    val firstMonday = sept1.minusDays(daysSinceMonday.toLong())
    val diffDays = ChronoUnit.DAYS.between(firstMonday, date)
    return (diffDays / 7).toInt() + 1
  }

  fun todayLineRu(date: LocalDate = today()): String {
    val base = date.format(fullDateFmt)
    return if (date.monthValue in 7..8) base else "$base · ${studyWeek(date)}-я неделя"
  }

  fun inDaysRu(days: Long): String {
    if (days <= 0) return "сегодня"
    if (days == 1L) return "завтра"
    val n = (days % 100).toInt()
    val d = n % 10
    val word = when {
      n in 11..14 -> "дней"
      d == 1 -> "день"
      d in 2..4 -> "дня"
      else -> "дней"
    }
    return "через $days $word"
  }

  fun daysUntil(iso: String?, from: LocalDate = today()): Long? {
    val date = parseDateOnly(iso) ?: return null
    return ChronoUnit.DAYS.between(from, date)
  }

  fun isOverdue(task: TaskDto, from: LocalDate = today()): Boolean {
    if (task.status == "DONE" || task.status == "CANCELLED") return false
    val due = parseDateOnly(task.dueDate) ?: return false
    return due.isBefore(from)
  }

  fun formatDueShort(iso: String?, dueTime: String? = null, from: LocalDate = today()): Pair<String, Boolean> {
    val date = parseDateOnly(iso) ?: return "Без срока" to false
    val diff = ChronoUnit.DAYS.between(from, date)
    val timeSuffix = if (!dueTime.isNullOrBlank()) " · $dueTime" else ""
    return when {
      diff < -1 -> "Просрочено (${date.format(dayShortMonthFmt).replace(".", "")})" to true
      diff == -1L -> "Вчера$timeSuffix" to true
      diff == 0L -> "Сегодня$timeSuffix" to true
      diff == 1L -> "Завтра$timeSuffix" to true
      diff in 2..6 -> {
        val wd = date.format(DateTimeFormatter.ofPattern("EEE, d MMM", ruLocale)).replace(".", "")
        "${wd.replaceFirstChar { it.uppercase(ruLocale) }}$timeSuffix" to false
      }
      else -> "${date.format(dayShortMonthFmt).replace(".", "")}$timeSuffix" to false
    }
  }

  fun formatEventTime(iso: String): String {
    return runCatching {
      Instant.parse(iso).atZone(ZoneId.systemDefault()).format(timeFmt)
    }.getOrDefault("")
  }

  fun formatShortDate(iso: String?): String {
    val d = parseDateOnly(iso) ?: return ""
    return d.format(dayShortMonthFmt).replace(".", "")
  }

  fun subjectShort(name: String): String {
    val words = name
      .replace(Regex("[^\\p{L}\\p{N}\\s-]"), " ")
      .split(Regex("[\\s-]+"))
      .filter { it.isNotBlank() }
    val main = words.filter { it.lowercase(ruLocale) !in shortSkip }
    val use = main.ifEmpty { words }
    if (use.isEmpty()) return "?"
    if (use.size == 1) return use[0].take(2).uppercase(ruLocale)
    return "${use[0].first()}${use[1].first()}".uppercase(ruLocale)
  }

  /**
   * Builds open tasks grouped by overdue + next 7 days, matching StudyHub web's buildWeekGroups().
   */
  fun buildWeekGroups(tasks: List<TaskDto>, from: LocalDate = today()): List<TaskDayGroup> {
    val open = tasks.filter { it.status != "DONE" && it.status != "CANCELLED" }
    val byTime = compareBy<TaskDto>({ it.dueTime ?: "99:99" }, { it.title.lowercase(ruLocale) })
    val groups = mutableListOf<TaskDayGroup>()

    val overdue = open
      .filter { parseDateOnly(it.dueDate)?.isBefore(from) == true }
      .sortedWith(compareBy<TaskDto> { parseDateOnly(it.dueDate) }.then(byTime))

    if (overdue.isNotEmpty()) {
      groups += TaskDayGroup(
        key = "overdue",
        label = "Просрочено",
        dateLabel = "${overdue.size}",
        urgent = true,
        items = overdue,
      )
    }

    val days = (0L..6L).map { from.plusDays(it) }
    val tomorrow = from.plusDays(1)
    var i = 0
    while (i < days.size) {
      val day = days[i]
      val items = open.filter { parseDateOnly(it.dueDate) == day }.sortedWith(byTime)
      val next = days.getOrNull(i + 1)
      if (day.dayOfWeek == DayOfWeek.SATURDAY && next != null && day != from && day != tomorrow) {
        val sundayItems = open.filter { parseDateOnly(it.dueDate) == next }.sortedWith(byTime)
        i += 2
        if (items.isNotEmpty() || sundayItems.isNotEmpty()) {
          val range = "${day.dayOfMonth}–${next.format(dayMonthFmt)}"
          groups += TaskDayGroup(
            key = day.toString(),
            label = "Выходные",
            dateLabel = range,
            urgent = false,
            items = items + sundayItems,
          )
        }
        continue
      }
      if (items.isNotEmpty()) {
        val near = day == from || day == tomorrow
        val label = when (day) {
          from -> "Сегодня"
          tomorrow -> "Завтра"
          else -> day.format(weekdayFullFmt).replaceFirstChar { it.uppercase(ruLocale) }
        }
        val dateLabel = if (near) {
          day.format(weekdayShortDateFmt).replace(".", "")
        } else {
          day.format(dayMonthFmt)
        }
        groups += TaskDayGroup(
          key = day.toString(),
          label = label,
          dateLabel = dateLabel,
          urgent = near,
          items = items,
        )
      }
      i += 1
    }

    return groups
  }

  /** Nearest open deadlines for Home Screen widget (overdue first, then chronological). */
  fun nearestDeadlines(tasks: List<TaskDto>, limit: Int = 6): List<TaskDto> {
    return tasks
      .filter { it.status != "DONE" && it.status != "CANCELLED" }
      .sortedWith(
        compareBy<TaskDto>(
          { parseDateOnly(it.dueDate) == null },
          { parseDateOnly(it.dueDate) ?: LocalDate.MAX },
          { it.dueTime ?: "99:99" },
          { priorityRank(it.priority) },
        ),
      )
      .take(limit)
  }

  private fun priorityRank(priority: String): Int = when (priority) {
    "CRITICAL" -> 0
    "HIGH" -> 1
    "MEDIUM" -> 2
    else -> 3
  }
}
