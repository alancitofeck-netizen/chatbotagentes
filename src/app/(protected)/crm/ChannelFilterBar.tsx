"use client";

import type { OpportunityCard, PipelineStage } from "@/lib/crm/queries";
import { CHANNELS, CHANNEL_LABEL, CHANNEL_ICON, resolveChannel, type Channel } from "@/lib/crm/channels";

/** Fila de pills de canal — misma fuente de datos que ya alimenta el
 * <Select> "Origen" existente (allCards/card.source), agrupada por
 * resolveChannel. Click en un pill setea `filters.channel`, el mismo campo
 * que ya lee filterAndSortBoard (boardFilters.ts) — no es un filtro
 * paralelo, es una segunda forma (visual, agrupada, con conteos) de acotar
 * el board. Cada pill también muestra cuántos de esos leads están en una
 * etapa "ganada" (stage.isWon), como primera aproximación honesta a "qué
 * canal convierte mejor" sin agregar una fila de KPIs nueva. */
export function ChannelFilterBar({
  cards,
  stages,
  value,
  onChange,
}: {
  cards: OpportunityCard[];
  stages: PipelineStage[];
  value: Channel | "";
  onChange: (channel: Channel | "") => void;
}) {
  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));

  const counts = new Map<Channel, { total: number; won: number }>();
  for (const channel of CHANNELS) counts.set(channel, { total: 0, won: 0 });
  for (const card of cards) {
    const channel = resolveChannel(card.source);
    const entry = counts.get(channel)!;
    entry.total += 1;
    if (wonStageIds.has(card.stageId)) entry.won += 1;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
          value === "" ? "bg-accent-100 text-accent-700" : "text-neutral-500 hover:bg-surface-2"
        }`}
      >
        Todos los canales <span className="text-neutral-400">{cards.length}</span>
      </button>
      {CHANNELS.map((channel) => {
        const Icon = CHANNEL_ICON[channel];
        const { total, won } = counts.get(channel)!;
        const active = value === channel;
        return (
          <button
            key={channel}
            type="button"
            onClick={() => onChange(active ? "" : channel)}
            title={won > 0 ? `${won} ganado(s) en este canal` : undefined}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
              active
                ? "border-accent-500 bg-accent-50 text-accent-700"
                : "border-border-default bg-surface-1 text-foreground hover:border-border-strong"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {CHANNEL_LABEL[channel]}
            <span className={active ? "text-accent-600" : "text-neutral-400"}>{total}</span>
          </button>
        );
      })}
    </div>
  );
}
