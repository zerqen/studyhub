import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type InteractiveCard = {
  id: string;
  title: string;
  description: string;
  updatedAt: string;
  lecture?: { title: string; number: number | null } | null;
  subject?: { name: string; emoji: string; color: string } | null;
};

/** Карточки схем: открываются на своей странице и там запускаются */
export function InteractiveCards({ items, showSubject }: { items: InteractiveCard[]; showSubject?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const color = it.subject?.color ?? "#0f8f7a";
        return (
          <Link key={it.id} href={`/interactives/${it.id}`} className="card card-hover group flex flex-col overflow-hidden">
            <div className="relative grid h-24 place-items-center" style={{ background: `linear-gradient(135deg, ${color}1f, ${color}08)` }}>
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl bg-surface shadow-card transition-transform duration-200 group-hover:scale-105"
                style={{ color }}
              >
                <MonitorPlay className="h-5 w-5" />
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="line-clamp-2 font-medium leading-snug">{it.title}</div>
              {it.description ? <p className="mt-1 line-clamp-2 text-sm text-muted">{it.description}</p> : null}
              <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-3 text-xs text-muted">
                {showSubject && it.subject ? (
                  <span>
                    {it.subject.emoji} {it.subject.name}
                  </span>
                ) : null}
                {it.lecture ? <span className="truncate">Лекция {it.lecture.number ?? ""} · {it.lecture.title}</span> : null}
                <span className="ml-auto shrink-0">{formatDate(it.updatedAt, "d MMM")}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
