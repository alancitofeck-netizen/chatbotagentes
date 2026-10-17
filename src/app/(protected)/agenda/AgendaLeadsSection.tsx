"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAgendaLeadsAction } from "@/lib/agenda/sheetPanelActions";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import type { AgendaLead } from "@/lib/agenda/sheetPanelTypes";

const SOURCE_LABELS: Record<string, string> = {
  agenda_sheet: "Hoja de agendas",
  google_sheets: "Hoja del asesor",
  mini_app: "Mini App",
  whatsapp: "WhatsApp",
  manychat: "ManyChat",
  instagram: "Instagram",
  asesoria: "Asesoría",
  asesoria_referral: "Referido",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Agenda → Leads: cada persona de la hoja de agendas (y cualquier lead con citas) queda guardada
 * acá — pedido explícito: "tiene que tener un apartado en la agenda donde quede guardado". */
export function AgendaLeadsSection({ refreshKey, lastSyncStartedAt }: { refreshKey: number; lastSyncStartedAt: string | null }) {
  const [leads, setLeads] = useState<AgendaLead[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAgendaLeadsAction()
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch(() => {
        if (!cancelled) setLeads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? []).filter((l) => !q || `${l.name} ${l.phone ?? ""} ${l.producto ?? ""} ${l.notas ?? ""}`.toLowerCase().includes(q));
  }, [leads, query]);

  if (leads === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando leads…
      </div>
    );
  }
  if (leads.length === 0) {
    return <EmptyState icon={Users} title="Todavía no hay leads en la agenda" description="Conectá tu hoja de agendas: cada persona que tenga una cita queda guardada acá." />;
  }

  const lastSync = lastSyncStartedAt ? new Date(lastSyncStartedAt).getTime() : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-3">
        <h2 className="text-[15px] font-semibold text-foreground">
          Leads <span className="text-neutral-400 tabular-nums">{leads.length}</span>
        </h2>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono, producto…"
            aria-label="Buscar lead"
            className="w-72 max-w-full rounded-md border border-border-strong bg-surface-1 py-1.5 pr-2.5 pl-8 text-[13px]"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="text-left text-[12px] text-neutral-500">
            <tr className="border-b border-border-default">
              {["Lead", "Producto", "Citas", "Última cita", "Próxima cita", "Estado", "Contactado", "Notas", "Origen"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isNew = lastSync !== null && l.source === "agenda_sheet" && !!l.createdAt && new Date(l.createdAt).getTime() >= lastSync - 1000;
              return (
                <tr key={l.contactId} className="border-b border-border-default last:border-b-0">
                  <td className="max-w-[240px] px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-foreground">{l.name}</span>
                      {isNew && <span className="shrink-0 rounded bg-success-strong px-1.5 py-px text-[10px] font-semibold tracking-wide text-white">NUEVO LEAD</span>}
                    </div>
                    {l.phone && (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-[12px] text-accent-600 hover:underline">
                        {l.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">{l.producto ? <Badge variant="info">{l.producto}</Badge> : <span className="text-neutral-400">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{l.citas}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.lastCitaAt ? formatDate(l.lastCitaAt) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.nextCitaAt ? formatDate(l.nextCitaAt) : "—"}</td>
                  <td className="px-3 py-2">{l.lastEstado ? <Badge variant={ESTADO_CITA_META[l.lastEstado].variant}>{ESTADO_CITA_META[l.lastEstado].label}</Badge> : l.citas === 0 ? <Badge variant="neutral">Eliminada en la hoja</Badge> : "—"}</td>
                  <td className="px-3 py-2">{l.contactado === null ? "—" : l.contactado ? "Sí" : "No"}</td>
                  <td className="max-w-[220px] px-3 py-2">
                    <span className="block truncate text-neutral-600" title={l.notas ?? undefined}>
                      {l.notas ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-neutral-600">{SOURCE_LABELS[l.source ?? ""] ?? l.source ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
