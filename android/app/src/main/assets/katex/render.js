(function () {
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInline(text) {
    var out = escapeHtml(text);
    // Inline code
    out = out.replace(/`([^`\n]+)`/g, function (_, code) {
      return "<code>" + code + "</code>";
    });
    // Bold
    out = out.replace(/\*\*([^\*\n]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    // Italic (avoid underscores inside words/tokens)
    out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
    return out;
  }

  function renderMarkdownToHtml(raw) {
    var text = (raw || "").replace(/\r\n/g, "\n");
    var codeBlocks = [];
    var mathBlocks = [];

    // 1. Protect fenced code blocks
    text = text.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, function (_, _lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push("<pre><code>" + escapeHtml(code.replace(/\n$/, "")) + "</code></pre>");
      return "\u0000CODE" + idx + "\u0000";
    });

    // 2. Protect display math $$...$$ and \[...\]
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, function (_, body) {
      var idx = mathBlocks.length;
      mathBlocks.push({ display: true, raw: body });
      return "\u0000MATH" + idx + "\u0000";
    });
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, function (_, body) {
      var idx = mathBlocks.length;
      mathBlocks.push({ display: true, raw: body });
      return "\u0000MATH" + idx + "\u0000";
    });

    // 3. Protect inline math $...$ and \(...\)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, function (_, body) {
      var idx = mathBlocks.length;
      mathBlocks.push({ display: false, raw: body });
      return "\u0000MATH" + idx + "\u0000";
    });
    text = text.replace(/(^|[^\\])\$([^\n$]+?)\$/g, function (_, prefix, body) {
      var idx = mathBlocks.length;
      mathBlocks.push({ display: false, raw: body });
      return prefix + "\u0000MATH" + idx + "\u0000";
    });

    // 4. Parse markdown blocks line-by-line
    var lines = text.split("\n");
    var html = [];
    var para = [];
    var listType = null; // 'ul' | 'ol'

    function flushPara() {
      if (para.length) {
        html.push("<p>" + para.map(renderInline).join("<br/>") + "</p>");
        para = [];
      }
    }

    function closeList() {
      if (listType) {
        html.push("</" + listType + ">");
        listType = null;
      }
    }

    function isTableLine(line) {
      return /^\s*\|.*\|\s*$/.test(line);
    }

    function isTableSeparator(line) {
      return /^\s*\|[\s:-]+(?:\|[\s:-]+)*\|\s*$/.test(line);
    }

    function splitTableRow(line) {
      return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(function (c) {
          return c.trim();
        });
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) {
        flushPara();
        closeList();
        continue;
      }

      // Standalone code placeholder
      if (/^\u0000CODE\d+\u0000$/.test(trimmed)) {
        flushPara();
        closeList();
        html.push(trimmed);
        continue;
      }

      // Horizontal rule
      if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
        flushPara();
        closeList();
        html.push("<hr/>");
        continue;
      }

      // Heading
      var hMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
      if (hMatch) {
        flushPara();
        closeList();
        var level = hMatch[1].length;
        html.push("<h" + level + ">" + renderInline(hMatch[2]) + "</h" + level + ">");
        continue;
      }

      // Markdown table
      if (isTableLine(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        flushPara();
        closeList();
        var headers = splitTableRow(trimmed);
        i += 2; // skip separator
        var tHtml = "<table><thead><tr>";
        for (var h = 0; h < headers.length; h++) {
          tHtml += "<th>" + renderInline(headers[h]) + "</th>";
        }
        tHtml += "</tr></thead><tbody>";
        while (i < lines.length && isTableLine(lines[i])) {
          var cells = splitTableRow(lines[i]);
          tHtml += "<tr>";
          for (var c = 0; c < headers.length; c++) {
            tHtml += "<td>" + renderInline(cells[c] || "") + "</td>";
          }
          tHtml += "</tr>";
          i++;
        }
        i--;
        tHtml += "</tbody></table>";
        html.push(tHtml);
        continue;
      }

      // Blockquote
      if (/^>\s?/.test(trimmed)) {
        flushPara();
        closeList();
        var qLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          qLines.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        i--;
        html.push("<blockquote>" + qLines.map(renderInline).join("<br/>") + "</blockquote>");
        continue;
      }

      // Checklist or bullet item
      var chkMatch = /^[-*•]\s+\[([ xX])\]\s+(.+)$/.exec(trimmed);
      if (chkMatch) {
        flushPara();
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html.push('<ul class="checklist">');
        }
        var checked = chkMatch[1].toLowerCase() === "x";
        html.push(
          '<li class="' +
            (checked ? "done" : "") +
            '"><span class="chk">' +
            (checked ? "☑" : "☐") +
            "</span> " +
            renderInline(chkMatch[2]) +
            "</li>"
        );
        continue;
      }

      var ulMatch = /^[-*•]\s+(.+)$/.exec(trimmed);
      if (ulMatch) {
        flushPara();
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          html.push("<ul>");
        }
        html.push("<li>" + renderInline(ulMatch[1]) + "</li>");
        continue;
      }

      var olMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
      if (olMatch) {
        flushPara();
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          html.push("<ol>");
        }
        html.push("<li>" + renderInline(olMatch[1]) + "</li>");
        continue;
      }

      closeList();
      para.push(line);
    }
    flushPara();
    closeList();

    var joined = html.join("\n");

    // 5. Restore math placeholders
    joined = joined.replace(/\u0000MATH(\d+)\u0000/g, function (_, idxStr) {
      var item = mathBlocks[Number(idxStr)];
      if (!item) return "";
      var safeLatex = escapeHtml(item.raw);
      return item.display ? "$$" + safeLatex + "$$" : "$" + safeLatex + "$";
    });

    // 6. Restore code blocks
    joined = joined.replace(/\u0000CODE(\d+)\u0000/g, function (_, idxStr) {
      return codeBlocks[Number(idxStr)] || "";
    });

    return joined;
  }

  function notifyHeight() {
    if (!window.AndroidBridge || typeof window.AndroidBridge.onHeight !== "function") return;
    var root = document.getElementById("root");
    var h = root ? Math.ceil(root.getBoundingClientRect().height) : document.documentElement.scrollHeight;
    if (h > 0) window.AndroidBridge.onHeight(h);
  }

  window.renderStudyHubMarkdown = function (rawMarkdown) {
    var root = document.getElementById("root");
    if (!root) return;
    root.innerHTML = renderMarkdownToHtml(rawMarkdown);

    if (typeof window.renderMathInElement === "function") {
      try {
        window.renderMathInElement(root, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
          strict: false,
        });
      } catch (_e) {}
    }

    notifyHeight();
    requestAnimationFrame(notifyHeight);
    setTimeout(notifyHeight, 80);
    setTimeout(notifyHeight, 240);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(notifyHeight);
    }
    if (typeof ResizeObserver !== "undefined" && !window.__shObserved) {
      window.__shObserved = true;
      new ResizeObserver(notifyHeight).observe(root);
    }
  };
})();
