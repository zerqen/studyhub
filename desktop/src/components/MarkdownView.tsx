import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  if (!content.trim()) return null;
  return (
    <div className={`prose-note text-[15px] text-fg ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
