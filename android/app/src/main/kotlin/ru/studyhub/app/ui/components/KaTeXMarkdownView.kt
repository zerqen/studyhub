package ru.studyhub.app.ui.components

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import ru.studyhub.app.ui.theme.StudyHubThemeColors

private fun Color.toCssHex(): String {
  val argb = toArgb()
  return String.format("#%06X", 0xFFFFFF and argb)
}

private class HeightBridge(private val onMeasured: (Int) -> Unit) {
  @JavascriptInterface
  fun onHeight(cssPx: Int) {
    if (cssPx > 0) onMeasured(cssPx)
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun KaTeXMarkdownView(
  markdown: String,
  modifier: Modifier = Modifier,
  textSizeSp: Int = 15,
  mutedText: Boolean = false,
) {
  val colors = StudyHubThemeColors.current
  val fgHex = (if (mutedText) colors.muted else colors.fg).toCssHex()
  val mutedHex = colors.muted.toCssHex()
  val accentHex = colors.accent.toCssHex()
  val subtleHex = colors.subtle.toCssHex()
  val lineHex = colors.line.toCssHex()
  val accentSoftHex = colors.accentSoft.toCssHex()

  val renderKey = remember(markdown, fgHex, accentHex, subtleHex, textSizeSp) {
    "$fgHex|$accentHex|$subtleHex|$textSizeSp|$markdown"
  }

  // Height measured in CSS px (which matches Android dp 1:1 at WebView zoom=100%)
  var contentHeightDp by remember(renderKey) { mutableIntStateOf(44) }

  val html = remember(renderKey) {
    val encodedJson = Json.encodeToString(markdown)
    """
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="katex.min.css" />
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: transparent;
          color: $fgHex;
          font-family: sans-serif;
          font-size: ${textSizeSp}px;
          line-height: 1.55;
          overflow-x: hidden;
          overflow-y: hidden;
          -webkit-text-size-adjust: 100%;
          overflow-wrap: anywhere;
        }
        #root > *:first-child { margin-top: 0; }
        #root > *:last-child { margin-bottom: 0; }
        p { margin: 0 0 0.6em 0; }
        h1 { font-family: serif; font-size: 1.32em; margin: 0.7em 0 0.35em; line-height: 1.3; }
        h2 { font-family: serif; font-size: 1.18em; margin: 0.65em 0 0.3em; line-height: 1.3; }
        h3, h4 { font-size: 1.05em; font-weight: 700; margin: 0.55em 0 0.25em; }
        ul, ol { margin: 0.3em 0 0.6em; padding-left: 1.3em; }
        ul.checklist { list-style: none; padding-left: 0.2em; }
        ul.checklist li.done { color: $mutedHex; text-decoration: line-through; }
        ul.checklist .chk { color: $accentHex; font-weight: 700; margin-right: 4px; }
        li { margin-bottom: 0.25em; }
        blockquote {
          margin: 0.5em 0;
          padding: 2px 0 2px 10px;
          border-left: 3px solid $accentHex;
          color: $mutedHex;
          font-style: italic;
        }
        code {
          font-family: monospace;
          font-size: 0.9em;
          background: $subtleHex;
          padding: 1px 5px;
          border-radius: 5px;
        }
        pre {
          margin: 0.55em 0;
          padding: 10px 12px;
          background: $subtleHex;
          border-radius: 10px;
          overflow-x: auto;
        }
        pre code { background: transparent; padding: 0; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.6em 0;
          font-size: 0.92em;
          display: block;
          overflow-x: auto;
        }
        th, td {
          border: 1px solid $lineHex;
          padding: 5px 8px;
          text-align: left;
        }
        th { background: $subtleHex; font-weight: 600; }
        hr { border: none; border-top: 1px solid $lineHex; margin: 0.75em 0; }
        .katex { font-size: 1.05em; }
        .katex-display {
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 10px;
          margin: 0.5em 0;
          border-radius: 10px;
          background: $accentSoftHex;
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script src="katex.min.js"></script>
      <script src="auto-render.min.js"></script>
      <script src="render.js"></script>
      <script>
        (function() {
          var md = $encodedJson;
          if (window.renderStudyHubMarkdown) {
            window.renderStudyHubMarkdown(md);
          }
        })();
      </script>
    </body>
    </html>
    """.trimIndent()
  }

  AndroidView(
    modifier = modifier
      .fillMaxWidth()
      .height(contentHeightDp.dp),
    factory = { context ->
      WebView(context).apply {
        setBackgroundColor(AndroidColor.TRANSPARENT)
        isVerticalScrollBarEnabled = false
        isHorizontalScrollBarEnabled = false
        overScrollMode = WebView.OVER_SCROLL_NEVER
        settings.javaScriptEnabled = true
        settings.allowFileAccess = true
        settings.domStorageEnabled = false
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = false
        addJavascriptInterface(
          HeightBridge { px ->
            post {
              if (px > 0 && px != contentHeightDp) {
                contentHeightDp = px + 4
              }
            }
          },
          "AndroidBridge",
        )
      }
    },
    update = { webView ->
      if (webView.tag != renderKey) {
        webView.tag = renderKey
        webView.loadDataWithBaseURL(
          "file:///android_asset/katex/",
          html,
          "text/html",
          "UTF-8",
          null,
        )
      }
    },
  )
}
