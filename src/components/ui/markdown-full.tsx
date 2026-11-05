"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { gapIndex } from "@/lib/definitions";

/** Тяжёлая часть Markdown (парсер и KaTeX): грузится отдельно и только там, где в тексте есть разметка */
export default function MarkdownFull({ children, inline, gap }: { children: string; inline?: boolean; gap?: (index: number) => ReactNode }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
      components={{
        a: ({ href, children: c }) => {
          const hidden = gap ? gapIndex(href) : null;
          if (hidden !== null) return gap?.(hidden);
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {c}
            </a>
          );
        },
        ...(inline ? { p: ({ children: c }) => <span>{c}</span> } : {}),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
