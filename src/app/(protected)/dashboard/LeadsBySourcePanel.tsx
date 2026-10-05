"use client";

import { useState, useTransition } from "react";
import type { LeadSource } from "@/lib/dashboard/queries";
import { getLeadsBySourceAction, type SourcePeriod } from "./actions";
import { LeadsBySourceChart } from "./LeadsBySourceChart";

const PERIODS: { key: SourcePeriod; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "todo", label: "Todo" },
];

/** "De dónde llegan": el período cambia la consulta real (contactos creados en
 * ese rango). Arranca con el historial completo que ya viene de la página. */
export function LeadsBySourcePanel({ initialSources }: { initialSources: LeadSource[] }) {
  const [period, setPeriod] = useState<SourcePeriod>("todo");
  const [sources, setSources] = useState(initialSources);
  const [pending, startTransition] = useTransition();

  function choose(next: SourcePeriod) {
    if (next === period) return;
    setPeriod(next);
    startTransition(async () => {
      setSources(await getLeadsBySourceAction(next));
    });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex gap-1 self-start rounded-full bg-surface-2 p-1" role="group" aria-label="Período">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period === p.key}
            onClick={() => choose(p.key)}
            className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors ${period === p.key ? "bg-navy text-white" : "text-neutral-600 hover:bg-surface-3"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={pending ? "opacity-60 transition-opacity" : ""}>
        <LeadsBySourceChart sources={sources} />
      </div>
    </div>
  );
}
