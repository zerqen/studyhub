package ru.studyhub.app.data

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
    "ldots" to "…", "dots" to "…", "cdots" to "⋯",
  )

  private val blackboard = mapOf(
    'R' to "ℝ", 'N' to "ℕ", 'Z' to "ℤ", 'Q' to "ℚ", 'C' to "ℂ", 'P' to "ℙ",
  )

  private val superscripts = mapOf(
    '0' to '⁰', '1' to '¹', '2' to '²', '3' to '³', '4' to '⁴',
    '5' to '⁵', '6' to '⁶', '7' to '⁷', '8' to '⁸', '9' to '⁹',
    '+' to '⁺', '-' to '⁻', '=' to '⁼', '(' to '⁽', ')' to '⁾',
    'n' to 'ⁿ', 'i' to 'ⁱ',
  )

  private val subscripts = mapOf(
    '0' to '₀', '1' to '₁', '2' to '₂', '3' to '₃', '4' to '₄',
    '5' to '₅', '6' to '₆', '7' to '₇', '8' to '₈', '9' to '₉',
    '+' to '₊', '-' to '₋', '=' to '₌', '(' to '₍', ')' to '₎',
    'a' to 'ₐ', 'e' to 'ₑ', 'h' to 'ₕ', 'i' to 'ᵢ', 'j' to 'ⱼ',
    'k' to 'ₖ', 'l' to 'ₗ', 'm' to 'ₘ', 'n' to 'ₙ', 'o' to 'ₒ',
    'p' to 'ₚ', 'r' to 'ᵣ', 's' to 'ₛ', 't' to 'ₜ', 'u' to 'ᵤ',
    'v' to 'ᵥ', 'x' to 'ₓ',
  )

  fun formatLatex(expr: String): String {
    var s = expr.trim()
    if (s.isEmpty()) return ""

    s = s.replace("\\left", "")
      .replace("\\right", "")
      .replace("\\displaystyle", "")
      .replace("\\,", " ")
      .replace("\\;", " ")
      .replace("\\!", "")

    // Unwrap \text{...}, \mathrm{...}, \mathbf{...}, \operatorname{...}
    val textWrappers = Regex("\\\\(?:text|mathrm|mathbf|mathit|operatorname)\\{([^{}]*)\\}")
    while (textWrappers.containsMatchIn(s)) {
      s = textWrappers.replace(s) { it.groupValues[1] }
    }

    // \mathbb{R} -> ℝ
    s = Regex("\\\\mathbb\\{([A-Za-z])\\}").replace(s) { m ->
      val ch = m.groupValues[1].firstOrNull()
      blackboard[ch] ?: m.groupValues[1]
    }

    // \frac{a}{b} (handles flat/inner-first braces)
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

    // \sqrt{x} -> √(x) or √x
    val sqrtRegex = Regex("\\\\sqrt\\{([^{}]+)\\}")
    while (sqrtRegex.containsMatchIn(s)) {
      s = sqrtRegex.replace(s) { m ->
        val inner = m.groupValues[1].trim()
        if (inner.length <= 2 && !inner.contains(' ')) "√$inner" else "√($inner)"
      }
    }

    // Greek letters & math symbols
    s = Regex("\\\\([A-Za-z]+)").replace(s) { m ->
      val cmd = m.groupValues[1]
      greek[cmd] ?: symbols[cmd] ?: m.value
    }

    // Superscripts ^{...} and ^x
    s = Regex("\\^\\{([^{}]+)\\}").replace(s) { m ->
      toSuperscript(m.groupValues[1]) ?: "^(${m.groupValues[1]})"
    }
    s = Regex("\\^([A-Za-z0-9+\\-])").replace(s) { m ->
      toSuperscript(m.groupValues[1]) ?: m.value
    }

    // Subscripts _{...} and _x
    s = Regex("_\\{([^{}]+)\\}").replace(s) { m ->
      toSubscript(m.groupValues[1]) ?: "_(${m.groupValues[1]})"
    }
    s = Regex("_([A-Za-z0-9+\\-])").replace(s) { m ->
      toSubscript(m.groupValues[1]) ?: m.value
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
    // Replace display math $$...$$
    s = Regex("\\$\\$([\\s\\S]*?)\\$\\$").replace(s) { m ->
      " " + formatLatex(m.groupValues[1]) + " "
    }
    // Replace inline math $...$
    s = Regex("\\$([^$\\n]+)\\$").replace(s) { m ->
      formatLatex(m.groupValues[1])
    }
    // Strip markdown formatting
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

  private fun toSuperscript(text: String): String? {
    val clean = text.trim()
    if (clean.isEmpty()) return ""
    val mapped = clean.map { ch ->
      if (ch == ' ') ' ' else superscripts[ch] ?: return null
    }
    return mapped.joinToString("")
  }

  private fun toSubscript(text: String): String? {
    val clean = text.trim()
    if (clean.isEmpty()) return ""
    val mapped = clean.map { ch ->
      if (ch == ' ') ' ' else subscripts[ch] ?: return null
    }
    return mapped.joinToString("")
  }
}
