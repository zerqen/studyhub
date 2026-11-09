"use client";

import { useEffect, useRef } from "react";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { cpp } from "@codemirror/lang-cpp";
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const color = (name: string) => `rgb(var(--${name}))`;

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier, t.processingInstruction], color: color("accent") },
  { tag: [t.typeName, t.standard(t.typeName)], color: color("success") },
  { tag: [t.string, t.character], color: color("warning") },
  { tag: [t.number, t.bool, t.null], color: color("danger") },
  { tag: [t.comment, t.lineComment, t.blockComment], color: color("muted") },
]);

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: color("fg"), height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: "1.55", overflow: "auto" },
  ".cm-content": { caretColor: color("fg"), padding: "10px 0" },
  ".cm-cursor": { borderLeftColor: color("fg") },
  ".cm-gutters": { backgroundColor: "transparent", color: color("muted"), border: "none" },
  ".cm-activeLine": { backgroundColor: "rgb(var(--subtle) / 0.6)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: color("fg") },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgb(var(--accent) / 0.25)" },
  ".cm-matchingBracket": { backgroundColor: "rgb(var(--accent) / 0.2)", color: "inherit" },
});

export default function CodeEditor({ value, onChange, resetKey }: { value: string; onChange: (code: string) => void; resetKey: number }) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initial = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          indentUnit.of("    "),
          bracketMatching(),
          closeBrackets(),
          cpp(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Редактор кода" }),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    return () => view.destroy();
    // resetKey пересоздаёт редактор при сбросе к заготовке
  }, [resetKey]);

  useEffect(() => {
    initial.current = value;
  }, [value]);

  // 16px на телефоне: иначе iOS увеличивает страницу при вводе
  return <div ref={host} className="h-full min-h-[320px] text-base md:text-[13px]" />;
}
