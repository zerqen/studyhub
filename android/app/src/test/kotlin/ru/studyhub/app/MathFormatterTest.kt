package ru.studyhub.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import ru.studyhub.app.data.MathFormatter

class MathFormatterTest {

  @Test
  fun formatsGreekLettersFractionsRootsAndPowersWithoutTofu() {
    assertEquals("α + β = γ", MathFormatter.formatLatex("\\alpha + \\beta = \\gamma"))
    assertEquals("a/b", MathFormatter.formatLatex("\\frac{a}{b}"))
    assertEquals("(x + 1)/2", MathFormatter.formatLatex("\\frac{x + 1}{2}"))
    assertEquals("√(x² + y²)", MathFormatter.formatLatex("\\sqrt{x^2 + y^2}"))
    assertEquals("x ∈ ℝ", MathFormatter.formatLatex("x \\in \\mathbb{R}"))
  }

  @Test
  fun formatsCalculusAndMatricesCleanlyWithoutMissingSubscriptGlyphs() {
    assertEquals("a_n → ∞", MathFormatter.formatLatex("a_n \\to \\infty"))
    assertEquals("a_ij", MathFormatter.formatLatex("a_{ij}"))
    assertEquals("det A = [a b; c d]", MathFormatter.formatLatex("\\det A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}"))
    assertEquals("∂f/∂x ≥ 0", MathFormatter.formatLatex("\\frac{\\partial f}{\\partial x} \\geq 0"))
  }

  @Test
  fun plainPreviewStripsMarkdownAndKeepsReadableMath() {
    val md = """
      # Интегралы
      **Формула:** $\int_0^1 x^2 dx = 1/3$
      - [x] Решить номер 5
    """.trimIndent()
    val preview = MathFormatter.plainPreview(md)
    assertTrue(preview.contains("Интегралы"))
    assertTrue(preview.contains("∫_0¹ x² dx = 1/3"))
    assertFalse(preview.contains("**"))
    assertFalse(preview.contains("#"))
  }
}
