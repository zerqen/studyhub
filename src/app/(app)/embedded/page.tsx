import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { blocks, tasks, tasksOfBlock } from "@/content/embedded";
import { cn } from "@/lib/utils";

export const metadata = { title: "Embedded" };

/** Цвет буквы блока — как в макете: A зелёный, B синий, C янтарный */
const BLOCK_INK: Record<string, string> = { A: "#15803D", B: "#0369A1", C: "#B45309" };

export default async function EmbeddedPage() {
  const user = await requireUser();
  const rows = await prisma.embeddedProgress.findMany({ where: { userId: user.id }, select: { taskSlug: true, solved: true } });
  const solved = new Set(rows.filter((r) => r.solved).map((r) => r.taskSlug));
  const started = new Set(rows.map((r) => r.taskSlug));
  const next = tasks.find((t) => !solved.has(t.slug));
  const nextBlock = next ? tasksOfBlock(next.block) : [];
  const blockDone = next ? nextBlock.filter((t) => solved.has(t.slug)).length : 0;

  const status = (slug: string) =>
    solved.has(slug)
      ? { label: "решена", cls: "bg-success/10 text-success" }
      : slug === next?.slug
        ? { label: "следующая", cls: "bg-accent-soft text-accent" }
        : started.has(slug)
          ? { label: "начата", cls: "bg-[#FBEBD5] text-[#8A4B08] dark:bg-warning/15 dark:text-warning" }
          : { label: "не начата", cls: "bg-subtle text-muted" };

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div className="space-y-1.5">
        <h1 className="heading text-[28px] leading-tight sm:text-[34px]">Embedded</h1>
        <p className="text-sm text-muted">Тренажёр C и C++ для микроконтроллеров</p>
      </div>

      {next ? (
        <section aria-label="Продолжить" className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-2xl bg-[#1D2130] px-5 py-[22px] text-[#FFFEFB] sm:px-[26px]">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B9BCC8]">
              {started.has(next.slug) ? "Продолжить" : "Следующая задача"} · блок {next.block} · {nextBlock.indexOf(next) + 1} из {nextBlock.length}
            </span>
            <span className="heading text-[22px] leading-snug sm:text-[26px]">{next.title}</span>
            <span className="text-sm text-[#D5D3CC]">{next.summary}</span>
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <span className="flex items-center gap-2.5 text-[13px] text-[#D5D3CC]">
              <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[#3A3F52]" aria-hidden>
                <span className="block h-full rounded-full bg-[#9DB4EE]" style={{ width: `${(blockDone / nextBlock.length) * 100}%` }} />
              </span>
              решено {blockDone} из {nextBlock.length}
            </span>
            <Link href={`/embedded/${next.slug}`} className="inline-flex h-[46px] items-center rounded-xl bg-[#FFFEFB] px-6 text-[15px] font-bold text-[#1D2130] transition-opacity hover:opacity-90">
              {started.has(next.slug) ? "Продолжить" : "Начать"}
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-[#1D2130] px-[26px] py-[22px] text-[#FFFEFB]">
          <span className="heading text-[22px]">Все задачи решены</span>
          <p className="mt-1 text-sm text-[#D5D3CC]">Новые блоки появятся здесь.</p>
        </section>
      )}

      {blocks.map((block) => {
        const list = tasksOfBlock(block.id);
        const done = list.filter((t) => solved.has(t.slug)).length;
        const ink = BLOCK_INK[block.id] ?? "#2D5BD2";
        const prog = list.length ? (done === 0 && !list.some((t) => started.has(t.slug)) ? (block.id === next?.block ? `0 из ${list.length}` : "не начат") : `${done} из ${list.length}`) : "скоро";
        return (
          // Блок с текущей задачей раскрыт; остальные — по клику
          <details key={block.id} open={block.id === (next?.block ?? "A")} className="group card overflow-hidden rounded-[14px]">
            <summary className="flex min-h-[76px] cursor-pointer list-none items-center gap-4 bg-[#F8F6F1] px-4 py-3.5 dark:bg-subtle sm:px-[22px] [&::-webkit-details-marker]:hidden">
              <span className="heading grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-xl" style={{ background: `${ink}1f`, color: ink }}>
                {block.id}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[17px] font-semibold">{block.title}</span>
                <span className="text-[13px] text-muted">{block.description.replace(/\.$/, "")}</span>
              </span>
              <span className="hidden whitespace-nowrap text-[13px] text-muted sm:inline">{prog}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <ul>
              {list.map((task, i) => {
                const st = status(task.slug);
                return (
                  <li key={task.slug}>
                    <Link
                      href={`/embedded/${task.slug}`}
                      className={cn(
                        "grid min-h-[62px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-[#ECE8DF] px-4 py-2 transition-colors hover:bg-subtle/60 dark:border-line sm:px-[22px]",
                        task.slug === next?.slug && "bg-[#F4F7FE] dark:bg-accent/5",
                      )}
                    >
                      <span className="font-mono text-[13px] text-muted">
                        {block.id}
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[15px] font-medium">{task.title}</span>
                        <span className="text-[13px] text-muted">{task.summary}</span>
                      </span>
                      <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", st.cls)}>{st.label}</span>
                    </Link>
                  </li>
                );
              })}
              {block.plannedTopics.length ? (
                <li className="border-t border-[#ECE8DF] px-4 py-3.5 dark:border-line sm:px-[22px]">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">{list.length ? "Дальше в блоке" : "Темы блока — задачи появятся позже"}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {block.plannedTopics.map((topic) => (
                      <span key={topic} className="rounded-full border border-dashed border-[#CFC9B8] px-2.5 py-0.5 text-[13px] text-muted dark:border-line">
                        {topic}
                      </span>
                    ))}
                  </span>
                </li>
              ) : null}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
