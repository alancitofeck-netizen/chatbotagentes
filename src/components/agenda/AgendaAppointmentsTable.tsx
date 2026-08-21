"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Download, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction } from "@/lib/agenda/actions";
import { CitaContactDetails } from "@/components/agenda/CitaContactDetails";

const TABS: { key: EstadoCita | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "agendada", label: "Agendadas" },
  { key: "confirmada", label: "Confirmadas" },
  { key: "realizada", label: "Realizadas" },
  { key: "no_show", label: "No Show" },
  { key: "cancelada", label: "Canceladas" },
  { key: "venta", label: "Ventas" },
];

const PAGE_SIZE = 8;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function EstadoCell({ cita, canEdit }: { cita: AgendaAppointment; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const meta = ESTADO_CITA_META[cita.estadoCita];

  if (!canEdit) return <Badge variant={meta.variant}>{meta.label}</Badge>;

  return (
    <Select
      label=""
      value={cita.estadoCita}
      disabled={isPending}
      containerClassName="w-auto"
      onChange={(e) => {
        const next = e.target.value as EstadoCita;
        startTransition(async () => {
          try {
            await updateEstadoCitaAction(cita.id, cita.workspaceId, next);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
          }
        });
      }}
    >
      {ESTADO_CITA_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {ESTADO_CITA_META[o].label}
        </option>
      ))}
    </Select>
  );
}

type SortKey = "fecha" | "asesor" | "setter" | "estado";

function compareBy(key: SortKey, a: AgendaAppointment, b: AgendaAppointment): number {
  switch (key) {
    case "fecha":
      return a.startTime.localeCompare(b.startTime);
    case "asesor":
      return a.advisorName.localeCompare(b.advisorName);
    case "setter":
      return (a.setterName ?? "").localeCompare(b.setterName ?? "");
    case "estado":
      return a.estadoCita.localeCompare(b.estadoCita);
  }
}

function SortableHeader({ label, sortKey, active, dir, onSort }: { label: string; sortKey: SortKey; active: boolean; dir: "asc" | "desc"; onSort: (key: SortKey) => void }) {
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 font-medium text-neutral-500 hover:text-foreground">
      {label}
      {active && (dir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />)}
    </button>
  );
}

/** Tabla completa de citas del rango seleccionado arriba (mismos datos que
 * la línea de tiempo, otra forma de verlos) — tabs por estado, búsqueda por
 * cliente/setter y exportación a CSV, todo sobre datos reales ya cargados
 * (sin fetch aparte). Compartida con la ficha de Asesores → Agenda
 * (asesores/[clientId]/agenda/page.tsx), que la usa de solo lectura
 * (canEditEstado=false) y sin exportHref — por eso es opcional: el botón de
 * descarga no tiene sentido ahí (el export CSV existente es por rango de
 * fechas del workspace activo, no por un asesor puntual).
 *
 * `showAdvisorColumn`/`sortable`/`onRowClick` son opcionales (default
 * false/undefined) — solo Asesores → Agendas (vista cross-asesor) los usa;
 * /agenda y la ficha del asesor siguen exactamente igual que antes. */
export function AgendaAppointmentsTable({
  citas,
  canEditEstado,
  exportHref,
  showAdvisorColumn = false,
  sortable = false,
  onRowClick,
}: {
  citas: AgendaAppointment[];
  canEditEstado: boolean;
  exportHref?: string;
  showAdvisorColumn?: boolean;
  sortable?: boolean;
  onRowClick?: (cita: AgendaAppointment) => void;
}) {
  const [tab, setTab] = useState<EstadoCita | "todas">("todas");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    let rows = tab === "todas" ? citas : citas.filter((c) => c.estadoCita === tab);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => (c.contactName ?? "").toLowerCase().includes(q) || (c.setterName ?? "").toLowerCase().includes(q) || c.advisorName.toLowerCase().includes(q));
    }
    if (sortable) {
      rows = [...rows].sort((a, b) => (sortDir === "asc" ? compareBy(sortKey, a, b) : -compareBy(sortKey, a, b)));
    }
    return rows;
  }, [citas, tab, search, sortable, sortKey, sortDir]);

  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);

  return (
    <Card>
      <CardHeader
        title="Todas las citas"
        action={
          exportHref ? (
            <a
              href={exportHref}
              title="Exportar a CSV"
              className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <Download size={16} aria-hidden="true" />
            </a>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  tab === t.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, setter…"
              className="w-full max-w-[220px] rounded-md border border-border-strong bg-surface-1 py-1.5 pr-3 pl-8 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">Sin citas para este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="pb-2 font-medium">{sortable ? <SortableHeader label="Fecha" sortKey="fecha" active={sortKey === "fecha"} dir={sortDir} onSort={handleSort} /> : "Fecha"}</th>
                  <th className="pb-2 font-medium">Hora</th>
                  <th className="pb-2 font-medium">Cliente / Lead</th>
                  {showAdvisorColumn && (
                    <th className="pb-2 font-medium">{sortable ? <SortableHeader label="Asesor" sortKey="asesor" active={sortKey === "asesor"} dir={sortDir} onSort={handleSort} /> : "Asesor"}</th>
                  )}
                  <th className="pb-2 font-medium">Tipo de cita</th>
                  <th className="pb-2 font-medium">{sortable ? <SortableHeader label="Setter" sortKey="setter" active={sortKey === "setter"} dir={sortDir} onSort={handleSort} /> : "Setter"}</th>
                  <th className="pb-2 font-medium">{sortable ? <SortableHeader label="Estado" sortKey="estado" active={sortKey === "estado"} dir={sortDir} onSort={handleSort} /> : "Estado"}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((cita) => (
                  <tr
                    key={cita.id}
                    onClick={onRowClick ? () => onRowClick(cita) : undefined}
                    className={`border-t border-border-default ${onRowClick ? "cursor-pointer hover:bg-surface-2" : ""}`}
                  >
                    <td className="py-2.5 text-neutral-500">{formatDate(cita.startTime)}</td>
                    <td className="py-2.5 text-neutral-500">{formatTime(cita.startTime)}</td>
                    <td className="py-2.5 font-medium text-foreground" onClick={(e) => e.stopPropagation()}>
                      <CitaContactDetails cita={cita}>{cita.contactName ?? "Sin nombre"}</CitaContactDetails>
                    </td>
                    {showAdvisorColumn && <td className="py-2.5 text-neutral-500">{cita.advisorName}</td>}
                    <td className="py-2.5 text-neutral-500">{cita.appointmentType ?? "—"}</td>
                    <td className="py-2.5 text-neutral-500">{cita.setterName ?? "—"}</td>
                    <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      <EstadoCell cita={cita} canEdit={canEditEstado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!expanded && filtered.length > PAGE_SIZE && (
          <button type="button" onClick={() => setExpanded(true)} className="self-start text-[13px] font-medium text-accent-600 hover:text-accent-700">
            Ver todas las citas ({filtered.length}) →
          </button>
        )}
      </div>
    </Card>
  );
}
