"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

/**
 * Markdown + формулы LaTeX: $x^2$ — в строке, $$\int_0^1 f(x)\,dx$$ — отдельной строкой.
 * Переносы строк сохраняются, как в обычном тексте.
 */
export const Markdown = memo(function Markdown({ children, className, inline }: { children: string; className?: string; inline?: boolean }) {
  // inline — для заголовков вопросов внутри ссылок и кнопок: без блочных тегов, чтобы не ломать вложенность HTML
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={cn("prose-note", inline && "prose-inline", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {c}
            </a>
          ),
          ...(inline ? { p: ({ children: c }) => <span>{c}</span> } : {}),
        }}
      >
        {children}
      </ReactMarkdown>
    </Wrapper>
  );
});
