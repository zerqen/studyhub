"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { FormulaGroup } from "@/lib/formulas";
import { Input } from "../ui/field";
import { Markdown } from "../ui/markdown";

/** Лист формул: открывается быстро, читается с телефона. Поиск работает и по подписи, и по самой формуле. */
export function FormulaSheet({ groups }: { groups: FormulaGroup[] }) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => e.title.toLowerCase().includes(q) || e.formulas.some((f) => f.toLowerCase().includes(q))),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, query]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative mb-4 no-print">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти: интеграл, предел, frac" aria-label="Поиск по формулам" className="pl-9" />
      </div>
      {shown.length === 0 ? <p className="card p-6 text-center text-sm text-muted">Ничего не нашлось</p> : null}
      <div className="space-y-6">
        {shown.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 text-sm font-semibold">{group.title}</h2>
            <div className="card divide-y divide-line">
              {group.entries.map((entry) => (
                <div key={entry.href} className="px-4 py-3">
                  <Link href={entry.href} className="block text-xs text-muted transition-colors hover:text-fg">
                    <Markdown inline>{entry.title}</Markdown>
                  </Link>
                  {entry.formulas.map((f) => (
                    <Markdown key={f}>{`$$\n${f}\n$$`}</Markdown>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
