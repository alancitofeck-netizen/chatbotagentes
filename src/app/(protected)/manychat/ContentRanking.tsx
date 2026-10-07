"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { fmtInt, fmtPct } from "./format";
import type { ContentStat } from "@/lib/manychat/leads";

/** Piezas con menos leads que esto no entran en el ranking de conversión (igual que el tablero anterior). */
const MIN_LEADS_FOR_CONVERSION = 5;

type Preset = "leads" | "conversion";

/** "Contenido que genera leads": ranking por cantidad o por conversión, con el canal de cada pieza. */
export function ContentRanking({ rows, hasCitas }: { rows: ContentStat[]; hasCitas: boolean }) {
  const [preset, setPreset] = useState<Preset>("leads");

  const shown = useMemo(() => {
    if (preset === "leads") return [...rows].sort((a, b) => b.leads - a.leads || a.contenido.localeCompare(b.contenido)).slice(0, 8);
    return rows
      .filter((r) => r.leads >= MIN_LEADS_FOR_CONVERSION)
      .sort((a, b) => b.conversion - a.conversion || b.leads - a.leads)
      .slice(0, 8);
  }, [rows, preset]);

  const hiddenForConversion = rows.filter((r) => r.leads < MIN_LEADS_FOR_CONVERSION).length;
  const maxLeads = Math.max(1, ...shown.map((r) => r.leads));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-1 p-5">
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">Contenido que genera leads</h2>

      <div role="group" aria-label="Orden del ranking" className="grid grid-cols-2 rounded-lg bg-surface-2 p-1">
        {(
          [
            ["leads", "Más leads"],
            ["conversion", "Mayor conversión"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            onClick={() => setPreset(value)}
            className={cn(
              "h-9 rounded-md text-[13px] font-medium transition-colors",
              preset === value ? "bg-accent-500 text-[#0a1024]" : "text-neutral-600 hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          {preset === "conversion" ? `Todavía no hay piezas con ${MIN_LEADS_FOR_CONVERSION} leads o más.` : "No hay contenido con leads."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((r) => (
            <li key={r.key} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-2 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${r.canalColor}22` }}>
                <span className="size-3 rounded-full" style={{ backgroundColor: r.canalColor }} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{r.contenido}</p>
                <p className="truncate text-[12px] text-neutral-500">
                  {r.canalNombre}
                  {hasCitas ? `, ${fmtPct(r.pasaCita)} pasa a cita` : ""}
                  {preset === "conversion" ? `, ${fmtPct(r.conversion)} a cliente` : ""}
                </p>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <i className="block h-full rounded-full" style={{ width: `${(r.leads / maxLeads) * 100}%`, backgroundColor: r.canalColor }} />
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-[20px] leading-none font-semibold tabular-nums text-foreground">
                  {preset === "conversion" ? fmtPct(r.conversion) : fmtInt(r.leads)}
                </p>
                <p className="text-[11px] text-neutral-500">{preset === "conversion" ? `${fmtInt(r.leads)} leads` : "leads"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {preset === "conversion" && hiddenForConversion > 0 && (
        <p className="text-[12px] text-neutral-500">
          Solo se comparan piezas con {MIN_LEADS_FOR_CONVERSION} leads o más ({hiddenForConversion} quedaron afuera).
        </p>
      )}
    </section>
  );
}
