"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarDays, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { updateBookingAttributionAction } from "@/lib/clients/actions";
import type { BookingFuente, BookingResultado, ClientAppointment } from "@/lib/clients/queries";
import { FUENTE_LABEL, RESULTADO_LABEL, getEstadoMeta } from "./appointmentMeta";

const PROVIDER_LABEL: Record<string, string> = { internal: "Interno", highlevel: "HighLevel", google: "Google", calendly: "Calendly" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const selectClass =
  "rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-border-default focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100";

/** Tabla de citas editable inline — compartida por Agenda y Operación (misma
 * forma, mismos datos; Operación agrega buscador). Fuente/Campaña/Resultado
 * se cargan a mano cita por cita (0127, sin integración con LinkedIn/Meta
 * Ads hoy) — arrancan vacíos y se actualizan optimistamente al editar. */
export function AppointmentsTable({
  appointments,
  nameById,
  clientId,
  searchable = false,
}: {
  appointments: ClientAppointment[];
  nameById: Map<string, string>;
  clientId: string;
  searchable?: boolean;
}) {
  const [rows, setRows] = useState(appointments);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((a) => (a.contactName ?? "").toLowerCase().includes(q) || (a.campana ?? "").toLowerCase().includes(q));
  }, [rows, query, searchable]);

  function patch(id: string, next: Partial<ClientAppointment>) {
    const previous = rows.find((a) => a.id === id);
    setRows((prev) => prev.map((a) => (a.id === id ? { ...a, ...next } : a)));
    startTransition(async () => {
      try {
        await updateBookingAttributionAction(id, clientId, {
          fuente: next.fuente,
          campana: next.campana,
          resultado: next.resultado,
        });
      } catch (err) {
        if (previous) setRows((prev) => prev.map((a) => (a.id === id ? previous : a)));
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  if (appointments.length === 0) {
    return <EmptyState icon={CalendarDays} title="Sin citas" description="Todavía no hay citas vinculadas a este cliente." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por lead o campaña…"
            className="w-full rounded-sm border border-border-strong bg-surface-1 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-default text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Lead</th>
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Fuente</th>
              <th className="py-2 pr-3 font-medium">Campaña</th>
              <th className="py-2 pr-3 font-medium">Setter</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const estado = getEstadoMeta(a);
              return (
                <tr key={a.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-2 pr-3 text-foreground">{a.contactName ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-500" title={PROVIDER_LABEL[a.provider] ?? a.provider}>
                    {formatDateTime(a.startTime)}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className={selectClass}
                      value={a.fuente ?? ""}
                      onChange={(e) => patch(a.id, { fuente: (e.target.value || null) as BookingFuente | null })}
                    >
                      <option value="">—</option>
                      {(Object.keys(FUENTE_LABEL) as BookingFuente[]).map((f) => (
                        <option key={f} value={f}>
                          {FUENTE_LABEL[f]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      defaultValue={a.campana ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const value = e.target.value.trim() || null;
                        if (value !== (a.campana ?? null)) patch(a.id, { campana: value });
                      }}
                      className="w-28 rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-border-default focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                    />
                  </td>
                  <td className="py-2 pr-3 text-neutral-500">{a.ownerId ? (nameById.get(a.ownerId) ?? "—") : "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      className={selectClass}
                      value={a.resultado ?? ""}
                      onChange={(e) => patch(a.id, { resultado: (e.target.value || null) as BookingResultado | null })}
                    >
                      <option value="">—</option>
                      {(Object.keys(RESULTADO_LABEL) as BookingResultado[]).map((r) => (
                        <option key={r} value={r}>
                          {RESULTADO_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
