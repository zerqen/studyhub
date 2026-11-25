package ru.studyhub.app.data

import java.time.DayOfWeek
import java.time.LocalDate
import java.util.Locale

data class QuickTaskParsed(
  val title: String,
  val kind: TaskKind,
  val subjectId: String?,
  val subjectName: String?,
  val dueDateIso: String?,
  val dueDateLabel: String?,
  val dueTime: String?,
)

/**
 * 1:1 Kotlin port of src/lib/quick-task.ts for instant offline parsing of
 * Russian quick-add task phrases like "ДЗ матан завтра 18:00" or "лаба 3 физика до 5.11".
 */
object QuickTaskParser {
  private val ruLocale = Locale.forLanguageTag("ru-RU")

  private val kindWords: List<Pair<Regex, TaskKind>> = listOf(
    Regex("^(лаба|лабу|лабы|лабе|лабораторн\\p{L}*|лр)$", RegexOption.IGNORE_CASE) to TaskKind.LAB,
    Regex("^(кр|контрольн\\p{L}*|самостоятельн\\p{L}*|коллоквиум\\p{L}*)$", RegexOption.IGNORE_CASE) to TaskKind.TEST,
    Regex("^(дз|домашк\\p{L}*|домашн\\p{L}*)$", RegexOption.IGNORE_CASE) to TaskKind.HOMEWORK,
    Regex("^(чертёж|чертеж\\p{L}*|чертёжи)$", RegexOption.IGNORE_CASE) to TaskKind.DRAWING,
  )

  private val weekdays: List<Pair<Regex, DayOfWeek>> = listOf(
    Regex("^(пн|понедельник\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.MONDAY,
    Regex("^(вт|вторник\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.TUESDAY,
    Regex("^(ср|сред\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.WEDNESDAY,
    Regex("^(чт|четверг\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.THURSDAY,
    Regex("^(пт|пятниц\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.FRIDAY,
    Regex("^(сб|суббот\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.SATURDAY,
    Regex("^(вс|воскресень\\p{L}*)$", RegexOption.IGNORE_CASE) to DayOfWeek.SUNDAY,
  )

  private val months = listOf(
    "январ", "феврал", "март", "апрел", "ма", "июн",
    "июл", "август", "сентябр", "октябр", "ноябр", "декабр",
  )

  private val stopWords = setOf(
    "до", "к", "ко", "в", "во", "на", "по", "через", "срок", "сдать", "сдача",
  )

  private val subjectAliases: List<Pair<Regex, String>> = listOf(
    Regex("^(матан|матанализ|матанал\\p{L}*)$", RegexOption.IGNORE_CASE) to "математический анализ",
    Regex("^(линал|линейка|алгебра)$", RegexOption.IGNORE_CASE) to "линейная алгебра",
    Regex("^(физра|физкультура)$", RegexOption.IGNORE_CASE) to "физическая культура",
    Regex("^(англ|английский|инглиш)$", RegexOption.IGNORE_CASE) to "иностранный язык",
    Regex("^(информатика|инф|ит)$", RegexOption.IGNORE_CASE) to "информационные технологии",
    Regex("^история$", RegexOption.IGNORE_CASE) to "история",
    Regex("^(начерт|инженерка)$", RegexOption.IGNORE_CASE) to "инженерная графика",
  )

  private fun normalizeName(raw: String): String =
    raw.lowercase(ruLocale)
      .replace('ё', 'е')
      .replace(Regex("[^\\p{L}\\p{Nd}\\s]"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()

  private fun commonPrefix(a: String, b: String): Int {
    val limit = minOf(a.length, b.length)
    var i = 0
    while (i < limit && a[i] == b[i]) i++
    return i
  }

  private fun dayMonth(day: Int, monthOneBased: Int, today: LocalDate, yearRaw: Int? = null): LocalDate? {
    if (day !in 1..31 || monthOneBased !in 1..12) return null
    var y = yearRaw ?: today.year
    if (yearRaw != null && yearRaw < 100) y += 2000
    var d = runCatching { LocalDate.of(y, monthOneBased, day) }.getOrNull() ?: return null
    if (yearRaw == null && d.isBefore(today.minusDays(60))) {
      d = runCatching { LocalDate.of(y + 1, monthOneBased, day) }.getOrNull() ?: return null
    }
    return d
  }

  fun parse(
    input: String,
    subjects: List<SubjectDto>,
    today: LocalDate = DateHelpers.today(),
  ): QuickTaskParsed {
    var text = " ${input.trim()} "
    var due: LocalDate? = null
    var dueTime: String? = null

    // Time: "в 10:45" or "18:00"
    val timeMatch = Regex("\\s(?:в\\s+)?([01]?\\d|2[0-3]):([0-5]\\d)(?=\\s)").find(text)
    if (timeMatch != null) {
      val hh = timeMatch.groupValues[1].toInt().toString().padStart(2, '0')
      val mm = timeMatch.groupValues[2]
      dueTime = "$hh:$mm"
      text = text.replaceFirst(Regex(Regex.escape(timeMatch.value)), " ")
    }

    // 5.11 / 05.11.2026 / 5/11
    val dmMatch = Regex("\\s(?:(?:до|к|на)\\s+)?(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?(?=\\s)").find(text)
    if (dmMatch != null) {
      val parsed = dayMonth(
        dmMatch.groupValues[1].toInt(),
        dmMatch.groupValues[2].toInt(),
        today,
        dmMatch.groupValues[3].takeIf { it.isNotEmpty() }?.toIntOrNull(),
      )
      if (parsed != null) {
        due = parsed
        text = text.replaceFirst(Regex(Regex.escape(dmMatch.value)), " ")
      }
    }

    // 5 ноября
    if (due == null) {
      val monthMatch = Regex("\\s(?:(?:до|к|на)\\s+)?(\\d{1,2})\\s+(\\p{L}+)(?=\\s)").find(text)
      if (monthMatch != null) {
        val word = monthMatch.groupValues[2].lowercase(ruLocale)
        val idx = months.indexOfFirst { p ->
          if (p == "ма") Regex("^ма[яй]$").matches(word) else word.startsWith(p)
        }
        if (idx >= 0) {
          val parsed = dayMonth(monthMatch.groupValues[1].toInt(), idx + 1, today)
          if (parsed != null) {
            due = parsed
            text = text.replaceFirst(Regex(Regex.escape(monthMatch.value)), " ")
          }
        }
      }
    }

    // сегодня / завтра / послезавтра
    if (due == null) {
      val relMatch = Regex("\\s(?:(?:до|к|на)\\s+)?(сегодня|завтра|послезавтра)(?=\\s)", RegexOption.IGNORE_CASE).find(text)
      if (relMatch != null) {
        val offset = when (relMatch.groupValues[1].lowercase(ruLocale)) {
          "сегодня" -> 0L
          "завтра" -> 1L
          else -> 2L
        }
        due = today.plusDays(offset)
        text = text.replaceFirst(Regex(Regex.escape(relMatch.value)), " ")
      }
    }

    // через 3 дня / через неделю / через 2 недели
    if (due == null) {
      val inMatch = Regex("\\sчерез\\s+(?:(\\d+)\\s+)?(дн\\p{L}*|день|недел\\p{L}*)(?=\\s)", RegexOption.IGNORE_CASE).find(text)
      if (inMatch != null) {
        val n = inMatch.groupValues[1].toLongOrNull() ?: 1L
        val unit = inMatch.groupValues[2].lowercase(ruLocale)
        due = today.plusDays(if (unit.startsWith("д")) n else n * 7L)
        text = text.replaceFirst(Regex(Regex.escape(inMatch.value)), " ")
      }
    }

    // в среду / к пятнице / до пн
    if (due == null) {
      val wordsMut = text.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.toMutableList()
      for (i in wordsMut.indices) {
        val w = wordsMut[i].lowercase(ruLocale)
        val wd = weekdays.firstOrNull { (re, _) -> re.matches(w) } ?: continue
        var diff = (wd.second.value - today.dayOfWeek.value + 7) % 7
        if (diff == 0) diff = 7
        due = today.plusDays(diff.toLong())
        val prev = wordsMut.getOrNull(i - 1)?.lowercase(ruLocale)
        if (prev != null && prev in stopWords) {
          wordsMut.removeAt(i)
          wordsMut.removeAt(i - 1)
        } else {
          wordsMut.removeAt(i)
        }
        text = " ${wordsMut.joinToString(" ")} "
        break
      }
    }

    val words = text.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    var kind = TaskKind.TASK
    for (w in words) {
      val k = kindWords.firstOrNull { (re, _) -> re.matches(w.lowercase(ruLocale)) }
      if (k != null) {
        kind = k.second
        break
      }
    }

    var matchedSubject: SubjectDto? = null
    val usedIndices = mutableSetOf<Int>()
    for (size in listOf(2, 1)) {
      if (matchedSubject != null) break
      var i = 0
      while (i + size <= words.size && matchedSubject == null) {
        val chunk = words.subList(i, i + size)
        val skip = chunk.any { w ->
          val low = w.lowercase(ruLocale)
          w.length < 3 || w.any { it.isDigit() } || low in stopWords || kindWords.any { (re, _) -> re.matches(low) }
        }
        if (!skip) {
          val found = matchSubject(subjects, chunk.joinToString(" "))
          if (found != null) {
            matchedSubject = found
            for (j in i until i + size) usedIndices += j
          }
        }
        i++
      }
    }

    val rest = words.filterIndexed { idx, _ -> idx !in usedIndices }.toMutableList()
    while (rest.isNotEmpty() && rest.last().lowercase(ruLocale) in stopWords) {
      rest.removeAt(rest.lastIndex)
    }

    var title = rest.joinToString(" ").replace(Regex("\\s+([,.])"), "$1").trim()
    if (rest.size == 1 && kindWords.any { (re, _) -> re.matches(rest[0].lowercase(ruLocale)) }) {
      title = ""
    }
    if (title.isBlank()) {
      title = if (kind == TaskKind.TASK) input.trim() else kind.fullLabel
    }
    title = title.replaceFirstChar { it.uppercase(ruLocale) }

    val dueIso = due?.let { DateHelpers.formatIsoDate(it) }
    val dueLabel = dueIso?.let { DateHelpers.formatDueShort(it, dueTime, today).first }
      ?: dueTime

    return QuickTaskParsed(
      title = title,
      kind = kind,
      subjectId = matchedSubject?.id,
      subjectName = matchedSubject?.name,
      dueDateIso = dueIso,
      dueDateLabel = dueLabel,
      dueTime = dueTime,
    )
  }

  private fun matchSubject(subjects: List<SubjectDto>, query: String): SubjectDto? {
    val q = normalizeName(query)
    if (q.length < 2) return null

    val norm = subjects.map { it to normalizeName(it.name) }
    val exact = norm.filter { it.second == q }
    if (exact.size == 1) return exact[0].first

    val alias = subjectAliases.firstOrNull { (re, _) -> re.matches(q) }?.second
    val candidates = listOfNotNull(q, alias).distinct()
    for (c in candidates) {
      val inc = norm.filter { (_, n) -> n.contains(c) || (c.length >= 4 && c.contains(n)) }
      if (inc.size == 1) return inc[0].first
      if (inc.size > 1) {
        val starts = inc.filter { (_, n) -> n.startsWith(c) }
        if (starts.size == 1) return starts[0].first
        return null
      }
    }

    val words = q.split(" ").filter { it.length >= 3 }
    if (words.isEmpty()) return null
    val scored = norm.mapNotNull { (subj, n) ->
      val target = n.split(" ").filter { it.isNotEmpty() }
      val hit = words.count { w ->
        target.any { t ->
          t.startsWith(w) || commonPrefix(w, t) >= maxOf(4, minOf(w.length, t.length) - 2)
        }
      }
      if (hit > 0) subj to (hit.toDouble() / words.size) else null
    }.sortedByDescending { it.second }

    if (scored.isEmpty()) return null
    return if (scored.size == 1 || scored[0].second > scored[1].second) scored[0].first else null
  }
}
