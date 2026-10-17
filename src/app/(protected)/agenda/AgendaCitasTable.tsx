"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Search } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { CitaContactDetails } from "@/components/agenda/CitaContactDetails";

const PRODUCTO_VARIANT: Record<string, BadgeVariant> = {
  "Gastos Médicos": "info",
  Vida: "accent",
  PPR: "success",
  Retiro: "warning",
  Ahorro: "success",
  Educación: "warning",
  Inversión: "accent",
};

const PAGE_SIZE = 25;

function formatDay(iso: string) {
  const label = new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

/** Mensaje según lo que pasó al escribir el estado de vuelta en la hoja (writeBack.ts). */
function notifyEstadoSaved(sheet: string) {
  if (sheet === "written") return toast.success("Estado actualizado", "También se actualizó en la hoja.");
  if (sheet === "no_token") return toast.info("Estado actualizado en el CRM", "Para escribirlo en la hoja, conectá la cuenta de Google en Configurar.");
  if (sheet === "row_moved") return toast.info("Estado actualizado en el CRM", "La fila de la hoja cambió de lugar: tocá Sincronizar ahora y volvé a intentar.");
  if (sheet === "no_estado_column") return toast.info("Estado actualizado en el CRM", "La hoja no tiene una columna mapeada a Estado de cita.");
  if (sheet === "error") return toast.error("Estado actualizado en el CRM", "No se pudo escribir en la hoja.");
  return toast.success("Estado actualizado");
}

function EstadoSelect({ cita, onChanged }: { cita: AgendaAppointment; onChanged: (estado: EstadoCita) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={cita.estadoCita}
      disabled={pending}
      aria-label={`Estado de la cita de ${cita.contactName ?? "lead"}`}
      onChange={(e) => {
        const next = e.target.value as EstadoCita;
        const previous = cita.estadoCita;
        onChanged(next);
        startTransition(async () => {
          try {
            const { sheet } = await updateEstadoCitaAction(cita.id, cita.workspaceId, next);
            notifyEstadoSaved(sheet);
          } catch (err) {
            onChanged(previous);
            toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
          }
        });
      }}
      className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-[12.5px] disabled:opacity-60"
    >
      {ESTADO_CITA_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {ESTADO_CITA_META[o].label}
        </option>
      ))}
    </select>
  );
}

type TabKey = EstadoCita | "todas" | "eliminadas";

/** "Todas las citas" — Fecha, Lead, Producto, Tipo, Notas, Contacté, Estado (editable, se escribe de
 * vuelta en la hoja) y Origen. Pestañas con contador según los estados que realmente aparecen. */
export function AgendaCitasTable({
  citas,
  lastSyncStartedAt,
  exportHref,
  onEstadoChanged,
}: {
  citas: AgendaAppointment[];
  lastSyncStartedAt: string | null;
  exportHref: string;
  onEstadoChanged: (id: string, estado: EstadoCita) => void;
}) {
  const [tab, setTab] = useState<TabKey>("todas");
  const [producto, setProducto] = useState("");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const counts = useMemo(() => {
    const map = new Map<TabKey, number>();
    for (const c of citas) {
      if (c.deletedInSheet) map.set("eliminadas", (map.get("eliminadas") ?? 0) + 1);
      else map.set(c.estadoCita, (map.get(c.estadoCita) ?? 0) + 1);
    }
    return map;
  }, [citas]);
  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: citas.filter((c) => !c.deletedInSheet).length },
    ...ESTADO_CITA_OPTIONS.filter((e) => counts.get(e)).map((e) => ({ key: e as TabKey, label: ESTADO_CITA_META[e].label, count: counts.get(e)! })),
    ...(counts.get("eliminadas") ? [{ key: "eliminadas" as TabKey, label: "Eliminadas en la hoja", count: counts.get("eliminadas")! }] : []),
  ];
  const productos = useMemo(() => [...new Set(citas.map((c) => c.producto).filter((p): p is string => !!p))].sort(), [citas]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return citas
      .filter((c) => (tab === "eliminadas" ? c.deletedInSheet : !c.deletedInSheet && (tab === "todas" || c.estadoCita === tab)))
      .filter((c) => !producto || c.producto === producto)
      .filter((c) => !q || `${c.contactName ?? ""} ${c.contactPhone ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [citas, tab, producto, query]);

  const lastSync = lastSyncStartedAt ? new Date(lastSyncStartedAt).getTime() : null;
  const isNewLead = (c: AgendaAppointment) =>
    lastSync !== null && c.fromSheet && c.contactSource === "agenda_sheet" && !!c.contactCreatedAt && new Date(c.contactCreatedAt).getTime() >= lastSync - 1000;

  return (
    <div className="rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-3">
        <h2 className="text-[15px] font-semibold text-foreground">Todas las citas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar lead…"
              aria-label="Buscar lead"
              className="w-44 rounded-md border border-border-strong bg-surface-1 py-1.5 pr-2.5 pl-8 text-[13px]"
            />
          </label>
          <select value={producto} onChange={(e) => setProducto(e.target.value)} aria-label="Filtrar por producto" className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px]">
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <a href={exportHref} className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2">
            <Download className="size-3.5" aria-hidden="true" /> Exportar
          </a>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border-default px-3 py-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setVisible(PAGE_SIZE);
            }}
            className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-medium ${tab === t.key ? "bg-accent-500 text-white" : "text-neutral-500 hover:bg-surface-2 hover:text-foreground"}`}
          >
            {t.label} <span className="tabular-nums opacity-80">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-[13px]">
          <thead className="text-left text-[12px] text-neutral-500">
            <tr className="border-b border-border-default">
              {["Fecha", "Lead", "Producto", "Tipo de cita", "Notas", "Contacté", "Estado", "Origen"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, visible).map((c) => (
              <tr key={c.id} className={`border-b border-border-default last:border-b-0 ${c.deletedInSheet ? "opacity-60" : ""}`}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-medium text-foreground">{formatDay(c.startTime)}</div>
                  {c.sinHora ? <div className="text-[12px] font-medium text-warning-strong">sin hora</div> : <div className="text-[12px] text-neutral-500">{formatTime(c.startTime)}</div>}
                </td>
                <td className="max-w-[260px] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <CitaContactDetails cita={c}>
                      <span className="block truncate font-medium text-foreground">{c.contactName ?? "—"}</span>
                    </CitaContactDetails>
                    {isNewLead(c) && <span className="shrink-0 rounded bg-success-strong px-1.5 py-px text-[10px] font-semibold tracking-wide text-white">NUEVO LEAD</span>}
                  </div>
                  <div className="truncate text-[12px] text-neutral-500">{c.contactPhone ?? ""}</div>
                </td>
                <td className="px-3 py-2">{c.producto ? <Badge variant={PRODUCTO_VARIANT[c.producto] ?? "neutral"}>{c.producto}</Badge> : <span className="text-neutral-400">—</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap text-neutral-600">{c.appointmentType ?? "—"}</td>
                <td className="max-w-[220px] px-3 py-2">
                  <span className="block truncate text-neutral-600" title={c.notes ?? undefined}>
                    {c.notes ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2">{c.contactado === null ? <span className="text-neutral-400">—</span> : c.contactado ? <span className="font-medium text-success-strong">Sí</span> : <span className="text-neutral-500">No</span>}</td>
                <td className="px-3 py-2">
                  {c.deletedInSheet ? <Badge variant="neutral">Eliminada en la hoja</Badge> : <EstadoSelect cita={c} onChanged={(estado) => onEstadoChanged(c.id, estado)} />}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${c.fromSheet ? "bg-success-bg text-success-strong" : "bg-surface-2 text-neutral-600"}`}>{c.fromSheet ? "Hoja" : "CRM"}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-neutral-500">
                  No hay citas para este filtro en el período elegido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > visible && (
        <div className="border-t border-border-default px-4 py-2 text-center">
          <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Mostrar más ({rows.length - visible})
          </button>
        </div>
      )}
      <p className="border-t border-border-default px-4 py-2.5 text-[12.5px] text-neutral-500">
        Si cambiás el estado acá, también se actualiza en la hoja. Los leads nuevos quedan guardados en Agenda → Leads.
      </p>
    </div>
  );
}
