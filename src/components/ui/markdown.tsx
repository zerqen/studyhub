"use client";

import { lazy, memo, Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const MarkdownFull = lazy(() => import("./markdown-full"));

/** Символы, с которых начинается любая разметка. Без них текст показывается как есть, парсер не нужен. */
const HAS_MARKUP = /[*_`$#[\]<>|~\\!]|^\s*(?:\d+[.)]|[-+])\s|https?:|www\.|@/m;

/**
 * Markdown + формулы LaTeX: $x^2$ — в строке, $$\int_0^1 f(x)\,dx$$ — отдельной строкой.
 * Переносы строк сохраняются, как в обычном тексте.
 * gap — чем рисовать скрытые части в режиме «Определения» (см. maskAnswer).
 */
export const Markdown = memo(function Markdown({ children, className, inline, gap }: { children: string; className?: string; inline?: boolean; gap?: (index: number) => ReactNode }) {
  // inline — для заголовков вопросов внутри ссылок и кнопок: без блочных тегов, чтобы не ломать вложенность HTML
  const Wrapper = inline ? "span" : "div";
  const plain = <span className="whitespace-pre-line">{children}</span>;
  return (
    <Wrapper className={cn("prose-note", inline && "prose-inline", className)}>
      {HAS_MARKUP.test(children) ? (
        <Suspense fallback={plain}>
          <MarkdownFull inline={inline} gap={gap}>
            {children}
          </MarkdownFull>
        </Suspense>
      ) : inline ? (
        plain
      ) : (
        <p className="whitespace-pre-line">{children}</p>
      )}
    </Wrapper>
  );
});
