package ru.studyhub.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import ru.studyhub.app.data.MathFormatter
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private sealed interface MdBlock {
  data class Heading(val level: Int, val text: String) : MdBlock
  data class Paragraph(val text: String) : MdBlock
  data class Quote(val text: String) : MdBlock
  data class Bullet(val marker: String, val text: String, val checked: Boolean? = null) : MdBlock
  data class CodeBlock(val code: String) : MdBlock
  data class MathBlock(val latex: String) : MdBlock
  data object Divider : MdBlock
}

@Composable
fun MarkdownMathText(
  markdown: String,
  modifier: Modifier = Modifier,
  baseStyle: TextStyle = MaterialTheme.typography.bodyLarge,
) {
  val colors = StudyHubThemeColors.current
  val blocks = remember(markdown) { parseMarkdownBlocks(markdown) }

  Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
    blocks.forEach { block ->
      when (block) {
        is MdBlock.Heading -> {
          val style = when (block.level) {
            1 -> MaterialTheme.typography.headlineMedium
            2 -> MaterialTheme.typography.titleLarge
            else -> MaterialTheme.typography.titleMedium
          }
          Text(
            text = renderInline(block.text, colors.accent, colors.subtle),
            style = style,
            color = colors.fg,
          )
        }
        is MdBlock.Paragraph -> {
          Text(
            text = renderInline(block.text, colors.accent, colors.subtle),
            style = baseStyle,
            color = colors.fg,
          )
        }
        is MdBlock.Quote -> {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .height(IntrinsicSize.Min),
          ) {
            Box(
              modifier = Modifier
                .width(3.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(2.dp))
                .background(colors.accent),
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
              text = renderInline(block.text, colors.accent, colors.subtle),
              style = baseStyle.copy(fontStyle = FontStyle.Italic),
              color = colors.muted,
              modifier = Modifier.weight(1f),
            )
          }
        }
        is MdBlock.Bullet -> {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .padding(start = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
          ) {
            Text(
              text = block.marker,
              style = baseStyle.copy(fontWeight = FontWeight.Bold),
              color = if (block.checked == true) colors.success else colors.accent,
            )
            Text(
              text = renderInline(block.text, colors.accent, colors.subtle),
              style = if (block.checked == true) {
                baseStyle.copy(textDecoration = TextDecoration.LineThrough)
              } else {
                baseStyle
              },
              color = if (block.checked == true) colors.muted else colors.fg,
              modifier = Modifier.weight(1f),
            )
          }
        }
        is MdBlock.CodeBlock -> {
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(10.dp))
              .background(colors.subtle)
              .horizontalScroll(rememberScrollState())
              .padding(12.dp),
          ) {
            Text(
              text = block.code,
              style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
              color = colors.fg,
            )
          }
        }
        is MdBlock.MathBlock -> {
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(10.dp))
              .background(colors.accentSoft.copy(alpha = 0.5f))
              .horizontalScroll(rememberScrollState())
              .padding(horizontal = 14.dp, vertical = 10.dp),
          ) {
            Text(
              text = MathFormatter.formatLatex(block.latex),
              style = MaterialTheme.typography.titleMedium.copy(
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
              ),
              color = colors.fg,
              textAlign = TextAlign.Center,
              modifier = Modifier.fillMaxWidth(),
            )
          }
        }
        MdBlock.Divider -> {
          HorizontalDivider(color = colors.line, modifier = Modifier.padding(vertical = 2.dp))
        }
      }
    }
  }
}

private fun parseMarkdownBlocks(raw: String): List<MdBlock> {
  if (raw.isBlank()) return emptyList()
  val lines = raw.replace("\r\n", "\n").split("\n")
  val out = mutableListOf<MdBlock>()
  var i = 0
  val para = mutableListOf<String>()

  fun flushPara() {
    if (para.isNotEmpty()) {
      out += MdBlock.Paragraph(para.joinToString("\n"))
      para.clear()
    }
  }

  while (i < lines.size) {
    val line = lines[i]
    val trimmed = line.trim()

    // Fenced code block ```
    if (trimmed.startsWith("```")) {
      flushPara()
      val buf = mutableListOf<String>()
      i++
      while (i < lines.size && !lines[i].trim().startsWith("```")) {
        buf += lines[i]
        i++
      }
      out += MdBlock.CodeBlock(buf.joinToString("\n"))
      i++
      continue
    }

    // Display math $$ ... $$
    if (trimmed.startsWith("$$")) {
      flushPara()
      if (trimmed.endsWith("$$") && trimmed.length > 4) {
        out += MdBlock.MathBlock(trimmed.removePrefix("$$").removeSuffix("$$"))
        i++
        continue
      }
      val buf = mutableListOf<String>()
      val firstRest = trimmed.removePrefix("$$").trim()
      if (firstRest.isNotEmpty()) buf += firstRest
      i++
      while (i < lines.size) {
        val cur = lines[i].trim()
        if (cur.endsWith("$$")) {
          val tail = cur.removeSuffix("$$").trim()
          if (tail.isNotEmpty()) buf += tail
          break
        }
        buf += lines[i]
        i++
      }
      out += MdBlock.MathBlock(buf.joinToString(" "))
      i++
      continue
    }

    if (trimmed.isEmpty()) {
      flushPara()
      i++
      continue
    }

    if (trimmed == "---" || trimmed == "***") {
      flushPara()
      out += MdBlock.Divider
      i++
      continue
    }

    val headingMatch = Regex("^(#{1,4})\\s+(.+)$").matchEntire(trimmed)
    if (headingMatch != null) {
      flushPara()
      out += MdBlock.Heading(headingMatch.groupValues[1].length, headingMatch.groupValues[2])
      i++
      continue
    }

    if (trimmed.startsWith(">")) {
      flushPara()
      out += MdBlock.Quote(trimmed.removePrefix(">").trim())
      i++
      continue
    }

    val checkMatch = Regex("^[-*]\\s+\\[([ xX])\\]\\s+(.+)$").matchEntire(trimmed)
    if (checkMatch != null) {
      flushPara()
      val checked = checkMatch.groupValues[1].equals("x", ignoreCase = true)
      out += MdBlock.Bullet(if (checked) "☑" else "☐", checkMatch.groupValues[2], checked)
      i++
      continue
    }

    val bulletMatch = Regex("^[-*•]\\s+(.+)$").matchEntire(trimmed)
    if (bulletMatch != null) {
      flushPara()
      out += MdBlock.Bullet("•", bulletMatch.groupValues[1])
      i++
      continue
    }

    val orderedMatch = Regex("^(\\d+\\.)\\s+(.+)$").matchEntire(trimmed)
    if (orderedMatch != null) {
      flushPara()
      out += MdBlock.Bullet(orderedMatch.groupValues[1], orderedMatch.groupValues[2])
      i++
      continue
    }

    para += line
    i++
  }
  flushPara()
  return out
}

private val inlineTokenRegex = Regex("(\\*\\*[^*]+\\*\\*|\\*[^*\\n]+\\*|`[^`\\n]+`|\\$[^$\\n]+\\$)")
private val mathOnlyRegex = Regex("(\\$[^$\\n]+\\$|`[^`\\n]+`)")

private fun AnnotatedString.Builder.appendFormattedSegment(
  text: String,
  accentColor: androidx.compose.ui.graphics.Color,
  codeBgColor: androidx.compose.ui.graphics.Color,
) {
  var cursor = 0
  for (m in mathOnlyRegex.findAll(text)) {
    if (m.range.first > cursor) {
      append(text.substring(cursor, m.range.first))
    }
    val token = m.value
    when {
      token.startsWith("`") && token.endsWith("`") -> {
        withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBgColor)) {
          append(" ${token.substring(1, token.length - 1)} ")
        }
      }
      token.startsWith("$") && token.endsWith("$") -> {
        val formatted = MathFormatter.formatLatex(token.substring(1, token.length - 1))
        withStyle(
          SpanStyle(
            fontFamily = FontFamily.Serif,
            fontStyle = FontStyle.Italic,
            color = accentColor,
          ),
        ) {
          append(formatted)
        }
      }
      else -> append(token)
    }
    cursor = m.range.last + 1
  }
  if (cursor < text.length) {
    append(text.substring(cursor))
  }
}

private fun renderInline(
  text: String,
  accentColor: androidx.compose.ui.graphics.Color,
  codeBgColor: androidx.compose.ui.graphics.Color,
): AnnotatedString {
  return buildAnnotatedString {
    var cursor = 0
    for (m in inlineTokenRegex.findAll(text)) {
      if (m.range.first > cursor) {
        append(text.substring(cursor, m.range.first))
      }
      val token = m.value
      when {
        token.startsWith("**") && token.endsWith("**") -> {
          withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
            appendFormattedSegment(token.substring(2, token.length - 2), accentColor, codeBgColor)
          }
        }
        token.startsWith("*") && token.endsWith("*") -> {
          withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
            appendFormattedSegment(token.substring(1, token.length - 1), accentColor, codeBgColor)
          }
        }
        token.startsWith("`") && token.endsWith("`") -> {
          withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBgColor)) {
            append(" ${token.substring(1, token.length - 1)} ")
          }
        }
        token.startsWith("$") && token.endsWith("$") -> {
          val formatted = MathFormatter.formatLatex(token.substring(1, token.length - 1))
          withStyle(
            SpanStyle(
              fontFamily = FontFamily.Serif,
              fontStyle = FontStyle.Italic,
              color = accentColor,
            ),
          ) {
            append(formatted)
          }
        }
        else -> append(token)
      }
      cursor = m.range.last + 1
    }
    if (cursor < text.length) {
      append(text.substring(cursor))
    }
  }
}
