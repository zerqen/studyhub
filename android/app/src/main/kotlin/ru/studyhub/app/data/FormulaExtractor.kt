package ru.studyhub.app.data

data class FormulaEntry(
  val title: String,
  val formulas: List<String>,
)

data class FormulaGroup(
  val title: String,
  val entries: List<FormulaEntry>,
)

/**
 * 1:1 Kotlin port of src/lib/formulas.ts: extracts unique LaTeX formulas from
 * subject questions and lecture summaries for the offline Formula Sheet.
 */
object FormulaExtractor {
  private val tokenRe = Regex("\\\\\\$|```[\\s\\S]*?```|`[^`\\n]+`|\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+?\\$")
  private val relationRe = Regex(
    "=|<|>|\\\\(?:frac|int|sum|prod|lim|le|ge|leq|geq|ne|neq|to|Rightarrow|iff|approx|sim|sqrt|partial|nabla)\\b",
  )
  private val spaceRe = Regex("\\s+")

  private fun normalize(latex: String): String = latex.replace(spaceRe, "")

  fun extractFormulas(markdown: String?): List<String> {
    if (markdown.isNullOrBlank()) return emptyList()
    val seen = hashSetOf<String>()
    val out = mutableListOf<String>()
    for (m in tokenRe.findAll(markdown)) {
      val token = m.value
      if (!token.startsWith("$")) continue
      val isBlock = token.startsWith("$$")
      val latex = (if (isBlock) token.drop(2).dropLast(2) else token.drop(1).dropLast(1)).trim()
      if (latex.isEmpty() || (!isBlock && !relationRe.containsMatchIn(latex))) continue
      val key = normalize(latex)
      if (seen.add(key)) {
        out += latex
      }
    }
    return out
  }

  fun buildFormulaSheet(
    lectures: List<LectureDto>,
    questions: List<QuestionDto>,
  ): List<FormulaGroup> {
    val seen = hashSetOf<String>()
    fun fresh(formulas: List<String>): List<String> = formulas.filter { f ->
      seen.add(normalize(f))
    }

    fun fromQuestions(lectureTitlePrefix: String?): List<FormulaEntry> {
      return questions.filter { q ->
        q.kind != "PROBLEM" && (
          if (lectureTitlePrefix == null) q.lectureTitle == null
          else q.lectureTitle == lectureTitlePrefix
        )
      }.mapNotNull { q ->
        val f = fresh(extractFormulas(q.answer))
        if (f.isEmpty()) null else FormulaEntry(title = q.text, formulas = f)
      }
    }

    val orderedLectures = lectures.sortedWith(compareBy<LectureDto> { it.number ?: Int.MAX_VALUE }.thenBy { it.date.orEmpty() })
    val groups = orderedLectures.mapNotNull { lec ->
      val lecMatchTitle = if (lec.number != null) "Лекция ${lec.number}: ${lec.title}" else lec.title
      val entries = fromQuestions(lecMatchTitle).toMutableList()
      val notesFormulas = fresh(extractFormulas(lec.summary))
      if (notesFormulas.isNotEmpty()) {
        entries += FormulaEntry(title = "Из конспекта", formulas = notesFormulas)
      }
      if (entries.isEmpty()) null else FormulaGroup(
        title = "${if (lec.number != null) "Лекция ${lec.number}. " else ""}${lec.title}",
        entries = entries,
      )
    }.toMutableList()

    val noLecture = fromQuestions(null)
    if (noLecture.isNotEmpty()) {
      groups += FormulaGroup(title = "Без лекции", entries = noLecture)
    }
    return groups
  }
}
