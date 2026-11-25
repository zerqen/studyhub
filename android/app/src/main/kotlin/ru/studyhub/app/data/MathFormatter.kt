package ru.studyhub.app.data

/**
 * Lightweight, tofu-free LaTeX -> readable plain text formatter for compact 2-line previews,
 * titles, and collapsed question headers. Full formulas/matrices use KaTeXMarkdownView.
 */
object MathFormatter {
  private val greek = mapOf(
    "alpha" to "α", "beta" to "β", "gamma" to "γ", "delta" to "δ", "epsilon" to "ε",
    "varepsilon" to "ε", "zeta" to "ζ", "eta" to "η", "theta" to "θ", "vartheta" to "ϑ",
    "iota" to "ι", "kappa" to "κ", "lambda" to "λ", "mu" to "μ", "nu" to "ν",
    "xi" to "ξ", "pi" to "π", "rho" to "ρ", "sigma" to "σ", "tau" to "τ",
    "upsilon" to "υ", "phi" to "φ", "varphi" to "φ", "chi" to "χ", "psi" to "ψ",
    "omega" to "ω",
    "Gamma" to "Γ", "Delta" to "Δ", "Theta" to "Θ", "Lambda" to "Λ", "Xi" to "Ξ",
    "Pi" to "Π", "Sigma" to "Σ", "Upsilon" to "Υ", "Phi" to "Φ", "Psi" to "Ψ", "Omega" to "Ω",
  )

  private val symbols = mapOf(
    "cdot" to "·", "times" to "×", "div" to "÷", "pm" to "±", "mp" to "∓",
    "leq" to "≤", "le" to "≤", "geq" to "≥", "ge" to "≥", "neq" to "≠", "ne" to "≠",
    "approx" to "≈", "equiv" to "≡", "sim" to "~", "propto" to "∝",
    "to" to "→", "rightarrow" to "→", "leftarrow" to "←", "leftrightarrow" to "↔",
    "Rightarrow" to "⇒", "Leftarrow" to "⇐", "Leftrightarrow" to "⇔", "iff" to "⇔",
    "in" to "∈", "notin" to "∉", "subset" to "⊂", "subseteq" to "⊆", "supset" to "⊃",
    "cup" to "∪", "cap" to "∩", "emptyset" to "∅", "varnothing" to "∅",
    "forall" to "∀", "exists" to "∃", "neg" to "¬", "land" to "∧", "lor" to "∨",
    "partial" to "∂", "nabla" to "∇", "sum" to "∑", "prod" to "∏",
    "int" to "∫", "iint" to "∬", "oint" to "∮", "infty" to "∞",
    "deg" to "°", "angle" to "∠", "perp" to "⊥", "parallel" to "∥",
    "ldots" to "…", "dots" to "…", "cdots" to "⋯", "vdots" to "⋮",
    "det" to "det", "sin" to "sin", "cos" to "cos", "tan" to "tan", "ctg" to "ctg",
    "ln" to "ln", "log" to "log", "lim" to "lim", "max" to "max", "min" to "min",
    "ker" to "ker", "dim" to "dim", "rank" to "rank", "inv" to "inv",
  )

  private val blackboard = mapOf(
    'R' to "ℝ", 'N' to "ℕ", 'Z' to "ℤ", 'Q' to "ℚ", 'C' to "ℂ", 'P' to "ℙ",
  )

  // Only universally available superscript digits & signs (no missing-glyph tofu boxes on Android!)
  private val safeSuperscripts = mapOf(
    '0' to '⁰', '1' to '¹', '2' to '²', '3' to '³', '4' to '⁴',
    '5' to '⁵', '6' to '⁶', '7' to '⁷', '8' to '⁸', '9' to '⁹',
    '+' to '⁺', '-' to '⁻',
  )

  fun formatLatex(expr: String): String {
    var s = expr.trim()
    if (s.isEmpty()) return ""

    // Simplify matrices in inline/preview text
    s = Regex("\\\\begin\\{(?:p|b|v|V)?matrix\\}([\\s\\S]*?)\\\\end\\{(?:p|b|v|V)?matrix\\}").replace(s) { m ->
      val body = m.groupValues[1].trim()
        .replace(Regex("\\s*\\\\\\\\\\s*"), "; ")
        .replace(Regex("\\s*&\\s*"), " ")
      "[$body]"
    }

    s = s.replace("\\left", "")
      .replace("\\right", "")
      .replace("\\displaystyle", "")
      .replace("\\,", " ")
      .replace("\\;", " ")
      .replace("\\!", "")

    val textWrappers = Regex("\\\\(?:text|mathrm|mathbf|mathit|operatorname)\\{([^{}]*)\\}")
    while (textWrappers.containsMatchIn(s)) {
      s = textWrappers.replace(s) { it.groupValues[1] }
    }

    s = Regex("\\\\mathbb\\{([A-Za-z])\\}").replace(s) { m ->
      val ch = m.groupValues[1].firstOrNull()
      blackboard[ch] ?: m.groupValues[1]
    }

    val fracRegex = Regex("\\\\(?:d|t)?frac\\{([^{}]+)\\}\\{([^{}]+)\\}")
    var guard = 0
    while (fracRegex.containsMatchIn(s) && guard < 8) {
      s = fracRegex.replace(s) { m ->
        val num = m.groupValues[1].trim()
        val den = m.groupValues[2].trim()
        val nStr = if (num.contains('+') || num.contains('-')) "($num)" else num
        val dStr = if (den.contains('+') || den.contains('-')) "($den)" else den
        "$nStr/$dStr"
      }
      guard++
    }

    val sqrtRegex = Regex("\\\\sqrt\\{([^{}]+)\\}")
    while (sqrtRegex.containsMatchIn(s)) {
      s = sqrtRegex.replace(s) { m ->
        val inner = m.groupValues[1].trim()
        if (inner.length <= 2 && !inner.contains(' ')) "√$inner" else "√($inner)"
      }
    }

    s = Regex("\\\\([A-Za-z]+)").replace(s) { m ->
      val cmd = m.groupValues[1]
      greek[cmd] ?: symbols[cmd] ?: cmd
    }

    // Safe numeric superscripts; keep letter superscripts like ^T or ^n readable without tofu
    s = Regex("\\^\\{([^{}]+)\\}").replace(s) { m ->
      toSafeSuperscript(m.groupValues[1]) ?: "^(${m.groupValues[1].trim()})"
    }
    s = Regex("\\^([A-Za-z0-9+\\-])").replace(s) { m ->
      toSafeSuperscript(m.groupValues[1]) ?: "^${m.groupValues[1]}"
    }

    // Keep subscripts clean ASCII (a_ij, S_n) so Android never draws missing-glyph □ boxes
    s = Regex("_\\{([^{}]+)\\}").replace(s) { m ->
      val inner = m.groupValues[1].trim()
      if (inner.length <= 2 && !inner.contains(' ')) "_$inner" else "_($inner)"
    }

    return s.replace("{", "")
      .replace("}", "")
      .replace(Regex("\\s+"), " ")
      .replace(Regex("([∂∇])\\s+(?=[A-Za-z])"), "$1")
      .trim()
  }

  fun plainPreview(markdown: String): String {
    if (markdown.isBlank()) return ""
    var s = markdown
    s = Regex("\\$\\$([\\s\\S]*?)\\$\\$").replace(s) { m ->
      " " + formatLatex(m.groupValues[1]) + " "
    }
    s = Regex("\\$([^$\\n]+)\\$").replace(s) { m ->
      formatLatex(m.groupValues[1])
    }
    s = s.replace(Regex("```[\\s\\S]*?```"), " [код] ")
      .replace(Regex("^#{1,6}\\s+", RegexOption.MULTILINE), "")
      .replace(Regex("^>\\s*", RegexOption.MULTILINE), "")
      .replace(Regex("^[-*]\\s+\\[[ xX]\\]\\s+", RegexOption.MULTILINE), "• ")
      .replace(Regex("^[-*]\\s+", RegexOption.MULTILINE), "• ")
      .replace("**", "")
      .replace("__", "")
      .replace("`", "")
    return s.replace(Regex("\\s+"), " ").trim()
  }

  private fun toSafeSuperscript(text: String): String? {
    val clean = text.trim()
    if (clean.isEmpty()) return ""
    val mapped = clean.map { ch -> safeSuperscripts[ch] ?: return null }
    return mapped.joinToString("")
  }
}
