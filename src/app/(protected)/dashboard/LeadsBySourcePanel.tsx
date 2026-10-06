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

/** Canales del prototipo. ManyChat cuenta como Instagram (mismo criterio que el CRM,
 * src/lib/crm/channels.ts). */
const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", color: "#1F9D5B", match: (s: string) => s === "whatsapp" },
  { key: "instagram", label: "Instagram", color: "#B02E6E", match: (s: string) => s === "instagram" || s === "manychat" },
] as const;

function countFor(sources: LeadSource[], match: (s: string) => boolean) {
  return sources.filter((s) => match(s.source.toLowerCase())).reduce((sum, s) => sum + s.count, 0);
}

/** "De dónde llegan": el período cambia la consulta real (contactos creados en ese
 * rango). Arranca con el historial completo que ya viene de la página. Muestra la
 * barra partida y las tarjetas por canal del prototipo, con los mismos conteos. */
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

  const channelCounts = CHANNELS.map((c) => ({ ...c, count: countFor(sources, c.match) }));
  const channelTotal = channelCounts.reduce((sum, c) => sum + c.count, 0);

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

      {channelTotal > 0 && (
        <>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={channelCounts.map((c) => `${c.label}: ${c.count}`).join(", ")}
          >
            {channelCounts.map((c) => (
              <i key={c.key} className="block h-full transition-[flex-grow] duration-500" style={{ flexGrow: c.count, backgroundColor: c.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {channelCounts.map((c) => (
              <div key={c.key} className="rounded-lg p-3" style={{ backgroundColor: `${c.color}1a` }}>
                <p className="font-display text-[26px] leading-none font-semibold tabular-nums text-foreground">{c.count}</p>
                <p className="mt-2 text-xs text-neutral-600">
                  {c.label}, {Math.round((c.count / channelTotal) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={pending ? "opacity-60 transition-opacity" : ""}>
        <LeadsBySourceChart sources={sources} />
      </div>
    </div>
  );
}
