"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Loader2, RefreshCw, Settings2, AlertTriangle, ExternalLink, Plus, FileSpreadsheet, Search, SlidersHorizontal, CalendarDays } from "lucide-react";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { getAgendaSheetStatusAction, syncAgendaSheetNowAction } from "@/lib/agenda/sheetPanelActions";
import type { AgendaSheetStatus } from "@/lib/agenda/sheetPanelTypes";
import { toast } from "@/components/toast/toast";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { AgendaSheetConnectPanel } from "./AgendaSheetConnectPanel";
import { AgendaLeadsSection } from "./AgendaLeadsSection";
import { AgendaWeekStrip } from "./AgendaWeekStrip";
import { AgendaStatsRow } from "./AgendaStatsRow";
import { AgendaCitaAccordionCard } from "./AgendaCitaAccordionCard";
import { AgendaRecordForm, type AgendaRecordFormRecord } from "./AgendaRecordForm";

const noopSubscribe = () => () => {};
const LISTA_DAYS_BACK = 90;
const LISTA_DAYS_FORWARD = 60;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatMinutesAgo(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "un momento";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return `${Math.round(diffH / 24)} d`;
}
function citaToRecord(cita: AgendaAppointment): AgendaRecordFormRecord {
  return {
    appointmentId: cita.id,
    appointmentWorkspaceId: cita.workspaceId,
    name: cita.contactName ?? "",
    phone: cita.contactPhone,
    email: cita.contactEmail,
    producto: cita.producto,
    appointmentType: cita.appointmentType,
    setterName: cita.setterName,
    notas: cita.notes,
    estadoCita: cita.estadoCita,
    startTime: cita.startTime,
    sinHora: cita.sinHora,
    fromSheet: cita.fromSheet,
  };
}

/** Agenda mobile — rediseño (pedido explícito: que se vea y funcione como agenda-movil.html):
 * franja de días de la semana + 3 stats (citas del día/asistencia/sin resultado) + tarjetas de
 * cita expandibles en el lugar (en vez de abrir una hoja aparte), más el formulario compartido
 * para crear/editar leads y citas a mano (AgendaRecordForm). Misma fuente de datos y misma
 * sincronización con Google Sheets que antes. */
export function AgendaMobileHome() {
  // La fecha de hoy se lee sólo en el cliente: el servidor corre en UTC y el
  // usuario en hora de Buenos Aires, así que no se renderiza en el HTML inicial.
  const todayMs = useSyncExternalStore(
    noopSubscribe,
    () => startOfDay(new Date()).getTime(),
    () => null,
  );

  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [weekAnchor, setWeekAnchor] = useState<Date | null>(null);
  const [showPending, setShowPending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [view, setView] = useState<"citas" | "leads">("citas");
  const [sheetStatus, setSheetStatus] = useState<AgendaSheetStatus | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const openPanel = useCallback(() => {
    setPanelKey((k) => k + 1);
    setPanelOpen(true);
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AgendaRecordFormRecord | null>(null);
  function openCreate() {
    setEditingRecord(null);
    setRecordSheetOpen(true);
  }
  function openEdit(cita: AgendaAppointment) {
    setEditingRecord(citaToRecord(cita));
    setRecordSheetOpen(true);
  }

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [setterFilter, setSetterFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoCita | "">("");

  const loadSheetStatus = useCallback(() => {
    getAgendaSheetStatusAction()
      .then(setSheetStatus)
      .catch(() => setSheetStatus({ account: { connected: false, email: null }, connection: null }));
  }, []);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  const afterSync = useCallback(() => {
    loadSheetStatus();
    setRefreshKey((k) => k + 1);
  }, [loadSheetStatus]);

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncAgendaSheetNowAction();
      if (!result.ok) toast.error("No se pudo sincronizar", result.message);
      else toast.success("Agenda sincronizada", `${result.created} citas nuevas, ${result.updated} actualizadas, ${result.newLeads} leads nuevos.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
    } finally {
      setSyncing(false);
      afterSync();
    }
  }

  function handleEstadoChanged(id: string, estado: EstadoCita) {
    setCitas((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, estadoCita: estado } : c)) : prev));
  }

  // Semilla de selectedDay/weekAnchor en cuanto se conoce "hoy" (cliente) — ajuste de estado
  // durante el render, no un efecto (mismo criterio que ya usa Sheet.tsx para esto), porque es una
  // respuesta directa a que todayMs pasó de null a un valor real.
  if (todayMs !== null && selectedDay === null) setSelectedDay(new Date(todayMs));
  if (todayMs !== null && weekAnchor === null) setWeekAnchor(new Date(todayMs));

  useEffect(() => {
    if (todayMs === null) return;
    const start = addDays(new Date(todayMs), -LISTA_DAYS_BACK);
    const end = addDays(new Date(todayMs), LISTA_DAYS_FORWARD);
    let cancelled = false;
    getAgendaAppointmentsAction({ start: start.toISOString(), end: end.toISOString() })
      .then((data) => {
        if (!cancelled) setCitas(data);
      })
      .catch(() => {
        if (!cancelled) setCitas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [todayMs, refreshKey]);

  const setterOptions = useMemo(() => [...new Set((citas ?? []).map((c) => c.setterName).filter((n): n is string => !!n))].sort(), [citas]);
  const activeFilterCount = (setterFilter ? 1 : 0) + (estadoFilter ? 1 : 0);

  const filteredCitas = useMemo(() => {
    let rows = citas ?? [];
    if (setterFilter) rows = rows.filter((c) => c.setterName === setterFilter);
    if (estadoFilter) rows = rows.filter((c) => c.estadoCita === estadoFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) => (c.contactName ?? "").toLowerCase().includes(q) || (c.contactPhone ?? "").includes(q));
    return rows;
  }, [citas, setterFilter, estadoFilter, search]);

  const dayCitas = useMemo(() => {
    if (!selectedDay) return [];
    return filteredCitas.filter((c) => !c.deletedInSheet && isSameDay(new Date(c.startTime), selectedDay)).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filteredCitas, selectedDay]);

  const pendingCitas = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredCitas
      .filter((c) => !c.deletedInSheet && new Date(c.startTime) < today && (c.estadoCita === "agendada" || c.estadoCita === "propuesta"))
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }, [filteredCitas]);

  const listToShow = showPending ? pendingCitas : dayCitas;
  const sheetUrl = sheetStatus?.connection ? `https://docs.google.com/spreadsheets/d/${sheetStatus.connection.spreadsheetId}/edit${sheetStatus.connection.sheetGid ? `#gid=${sheetStatus.connection.sheetGid}` : ""}` : null;

  if (todayMs === null || selectedDay === null || weekAnchor === null) return null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 md:hidden">
      <AgendaSheetConnectPanel key={panelKey} open={panelOpen} onClose={() => setPanelOpen(false)} status={sheetStatus} onSynced={afterSync} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground">Agenda</h1>
            <ModuleHelp
              compact
              description="La Agenda te permite organizar tus próximas citas y seguimientos — llegan solas desde tu hoja conectada, o las cargás a mano con +."
              tourKey="agenda-intro"
            />
          </div>
          {sheetStatus === null ? (
            <div className="mt-1.5 h-4 w-40 animate-pulse rounded bg-surface-2" />
          ) : sheetStatus.connection ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-neutral-500">
              {sheetStatus.connection.lastSyncStatus === "error" ? (
                <AlertTriangle className="size-3.5 text-error-strong" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-success-strong" aria-hidden="true" />
              )}
              <span>Sincronizado · {sheetStatus.connection.lastSyncedAt ? `hace ${formatMinutesAgo(sheetStatus.connection.lastSyncedAt)}` : "todavía no"}</span>
              <button type="button" onClick={handleSyncNow} disabled={syncing} aria-label="Sincronizar ahora" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2">
                {syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
              </button>
              {sheetUrl && (
                <a href={sheetUrl} target="_blank" rel="noreferrer" aria-label="Abrir hoja" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={openPanel} aria-label="Configurar" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2">
                <Settings2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={openPanel} className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-accent-600">
              <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              Conectá tu hoja de agendas
            </button>
          )}
        </div>
        {view === "citas" && (
          <button
            type="button"
            onClick={openCreate}
            aria-label="Nueva cita"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white shadow-[var(--elevation-sm)] hover:bg-accent-600"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex gap-1 self-start rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Vista de la agenda">
        {(["citas", "leads"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`min-h-9 rounded-md px-4 text-[13px] font-medium ${view === v ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
          >
            {v === "citas" ? "Citas" : "Leads"}
          </button>
        ))}
      </div>

      {view === "leads" ? (
        <AgendaLeadsSection refreshKey={refreshKey} compact />
      ) : (
        <>
          <AgendaWeekStrip
            weekAnchor={weekAnchor}
            selectedDay={selectedDay}
            onSelectDay={(d) => {
              setSelectedDay(d);
              setShowPending(false);
              setExpandedId(null);
            }}
            onPrevWeek={() => setWeekAnchor((d) => addDays(d!, -7))}
            onNextWeek={() => setWeekAnchor((d) => addDays(d!, 7))}
            citas={filteredCitas}
          />

          <AgendaStatsRow
            citas={filteredCitas}
            selectedDay={selectedDay}
            pendingActive={showPending}
            onTogglePending={() => {
              setShowPending((v) => !v);
              setExpandedId(null);
            }}
          />

          <div className="flex items-center gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                aria-label="Buscar por nombre o teléfono"
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-1 py-2 pr-3 pl-9 text-[14px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="Filtros"
              className="relative flex size-11 shrink-0 items-center justify-center rounded-md border border-border-default text-neutral-500"
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              {activeFilterCount > 0 && <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-accent-500 text-[10px] text-white">{activeFilterCount}</span>}
            </button>
          </div>

          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="text-[14px] font-semibold text-foreground">
              {showPending
                ? "Sin resultado"
                : isSameDay(selectedDay, new Date(todayMs))
                  ? "Hoy"
                  : selectedDay.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
            </h2>
            <span className="text-[12.5px] text-neutral-500">
              {listToShow.length} {listToShow.length === 1 ? "cita" : "citas"}
            </span>
          </div>

          {citas === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Cargando agenda…
            </div>
          ) : listToShow.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={showPending ? "Todo al día" : "No hay citas"}
              description={showPending ? "No te quedan citas sin resultado." : "No hay citas para este día — tocá + para cargar una a mano."}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {listToShow.map((c) => (
                <AgendaCitaAccordionCard
                  key={c.id}
                  cita={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                  onEstadoChanged={handleEstadoChanged}
                  onEditar={() => openEdit(c)}
                />
              ))}
            </div>
          )}

          <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrar citas">
            <div className="flex flex-col gap-4 p-5">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                Setter
                <select value={setterFilter} onChange={(e) => setSetterFilter(e.target.value)} className="min-h-11 rounded-md border border-border-strong bg-surface-1 px-3 text-[14px]">
                  <option value="">Todos</option>
                  {setterOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
                Estado
                <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as EstadoCita | "")} className="min-h-11 rounded-md border border-border-strong bg-surface-1 px-3 text-[14px]">
                  <option value="">Todos</option>
                  {ESTADO_CITA_OPTIONS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_CITA_META[e].label}
                    </option>
                  ))}
                </select>
              </label>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSetterFilter("");
                    setEstadoFilter("");
                  }}
                  className="self-start text-[13px] font-medium text-accent-600"
                >
                  Limpiar filtros
                </button>
              )}
              <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 rounded-md bg-accent-500 text-[14px] font-medium text-white">
                Ver resultados
              </button>
            </div>
          </Sheet>

          <Sheet open={recordSheetOpen} onClose={() => setRecordSheetOpen(false)} title={editingRecord ? (editingRecord.fromSheet ? "Editar cita" : "Editar lead") : "Nueva cita"}>
            <AgendaRecordForm
              key={editingRecord?.appointmentId ?? "new"}
              record={editingRecord}
              defaultDate={selectedDay}
              onClose={() => setRecordSheetOpen(false)}
              onSaved={() => setRefreshKey((k) => k + 1)}
            />
          </Sheet>
        </>
      )}
    </div>
  );
}
