"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, useRef } from "react";
import { Loader2, CalendarSearch, X, Plus, FileSpreadsheet, RefreshCw, Settings2, AlertTriangle, ExternalLink } from "lucide-react";
import { getMonday, addDays } from "@/lib/calendar/week";
import { getAgendaAppointmentsAction } from "@/lib/agenda/actions";
import type { AgendaAppointment, EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { getAgendaSheetStatusAction, syncAgendaSheetNowAction } from "@/lib/agenda/sheetPanelActions";
import type { AgendaSheetStatus } from "@/lib/agenda/sheetPanelTypes";
import { toast } from "@/components/toast/toast";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { AgendaSheetConnectPanel } from "./AgendaSheetConnectPanel";
import { AgendaLeadsSection } from "./AgendaLeadsSection";
import { AgendaFunnelStrip } from "./AgendaFunnelStrip";
import { AgendaCitasList } from "./AgendaCitasList";
import { AgendaCitaDetailPanel } from "./AgendaCitaDetailPanel";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type Granularity = "dia" | "semana" | "mes" | "lista";
const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "lista", label: "Lista" },
];
/** "Lista" no navega por selectedDate — siempre una ventana rodante centrada en hoy, para que
 * "Necesitan resultado"/"Próximas" muestren lo que realmente importa sin tener que ir clickeando
 * meses. 90 días atrás alcanza para pescar citas vencidas sin sincronizar hace rato; 60 adelante
 * cubre cualquier horizonte de agendamiento real. */
const LISTA_DAYS_BACK = 90;
const LISTA_DAYS_FORWARD = 60;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function rangeFor(granularity: Granularity, selectedDate: Date): { start: string; end: string } {
  const day = startOfDay(selectedDate);
  if (granularity === "dia") return { start: day.toISOString(), end: addDays(day, 1).toISOString() };
  if (granularity === "semana") {
    const monday = getMonday(day);
    return { start: monday.toISOString(), end: addDays(monday, 7).toISOString() };
  }
  if (granularity === "lista") return { start: addDays(day, -LISTA_DAYS_BACK).toISOString(), end: addDays(day, LISTA_DAYS_FORWARD).toISOString() };
  const monthStart = firstOfMonth(day);
  return { start: monthStart.toISOString(), end: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString() };
}

function periodLabel(granularity: Granularity, selectedDate: Date): string {
  const today = new Date();
  const tomorrow = addDays(startOfDay(today), 1);
  if (granularity === "dia") {
    const prefix = isSameDay(selectedDate, today) ? "Hoy, " : isSameDay(selectedDate, tomorrow) ? "Mañana, " : "";
    return prefix + selectedDate.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }
  if (granularity === "semana") {
    const monday = getMonday(startOfDay(selectedDate));
    const sunday = addDays(monday, 6);
    return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${sunday.toLocaleDateString("es-MX", { month: "long" })}`;
  }
  const label = selectedDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Vista operativa de Agenda ("Citas") — rediseño: franja de embudo (5 celdas), lista agrupada
 * Necesitan resultado/Hoy/Próximas + panel de detalle persistente en escritorio, todo sobre
 * agenda_appointments real (espejo de la hoja conectada, ver src/lib/agenda/queries.ts), nunca
 * datos de ejemplo. Sincronización con Google Sheets intacta: misma hoja, mismo "Sincronizar
 * ahora", mismo panel "Conectar hoja de agendas" (AgendaSheetConnectPanel, sin tocar). Un 'agent'
 * (setter) recibe del server solo sus propias citas; la edición de estado/notas está disponible
 * para los 3 roles (ver agenda/queries.ts). */
export function AgendaShell() {
  useAutoStartTour("agenda-intro");
  const [granularity, setGranularity] = useState<Granularity>("lista");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const [citas, setCitas] = useState<AgendaAppointment[] | null>(null);
  const [loading, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [newCitaOpen, setNewCitaOpen] = useState(false);
  const [setterFilter, setSetterFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoCita | "">("");
  const [search, setSearch] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Hoja de agendas conectada (0199): franja de estado, panel "Conectar hoja", "Sincronizar ahora".
  const [view, setView] = useState<"citas" | "leads">("citas");
  const [sheetStatus, setSheetStatus] = useState<AgendaSheetStatus | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelKey, setPanelKey] = useState(0);
  const openPanel = useCallback(() => {
    setPanelKey((k) => k + 1);
    setPanelOpen(true);
    setNewCitaOpen(false);
  }, []);
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSheetStatus = useCallback(() => {
    getAgendaSheetStatusAction()
      .then(setSheetStatus)
      .catch(() => setSheetStatus({ account: { connected: false, email: null }, connection: null }));
  }, []);

  useEffect(() => {
    loadSheetStatus();
    // Vuelta del OAuth de Google ("Conectar cuenta de Google" en el panel): reabre el panel.
    const params = new URLSearchParams(window.location.search);
    if (params.has("sheet_export_connected") || params.has("sheet_export_error")) {
      if (params.has("sheet_export_error")) toast.error("No se pudo conectar la cuenta de Google.");
      window.history.replaceState(null, "", window.location.pathname);
      Promise.resolve().then(openPanel);
    }
  }, [loadSheetStatus, openPanel]);

  const afterSync = useCallback(() => {
    loadSheetStatus();
    setRefreshKey((k) => k + 1);
  }, [loadSheetStatus]);

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const result = await syncAgendaSheetNowAction();
      if (!result.ok) toast.error("No se pudo sincronizar", result.message);
      else {
        const extra = (result.deletedInSheet ? `, ${result.deletedInSheet} eliminadas en la hoja` : "") + (result.errors ? ` · ${result.errors} filas con problemas` : "");
        toast.success("Agenda sincronizada", `${result.created} citas nuevas, ${result.updated} actualizadas, ${result.newLeads} leads nuevos${extra}.`);
      }
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

  const range = useMemo(() => rangeFor(granularity, selectedDate), [granularity, selectedDate]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const data = await getAgendaAppointmentsAction(range);
      if (!cancelled) setCitas(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, refreshKey]);

  const setterOptions = useMemo(() => [...new Set((citas ?? []).map((c) => c.setterName).filter((n): n is string => !!n))].sort(), [citas]);

  const filteredCitas = useMemo(() => {
    let rows = citas ?? [];
    if (setterFilter) rows = rows.filter((c) => c.setterName === setterFilter);
    if (estadoFilter) rows = rows.filter((c) => c.estadoCita === estadoFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((c) => (c.contactName ?? "").toLowerCase().includes(q) || (c.contactPhone ?? "").includes(q));
    return rows;
  }, [citas, setterFilter, estadoFilter, search]);

  const selectedCita = useMemo(() => {
    const fromFiltered = filteredCitas.find((c) => c.id === selectedId);
    if (fromFiltered) return fromFiltered;
    if (selectedId) return null;
    // Por defecto: la primera cita que "necesita resultado", si no la próxima — mismo criterio
    // que la franja "Necesitan resultado" de la lista.
    const today = startOfDay(new Date());
    const overdue = filteredCitas.filter((c) => !c.deletedInSheet && new Date(c.startTime) < today && (c.estadoCita === "agendada" || c.estadoCita === "propuesta"));
    if (overdue.length > 0) return [...overdue].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    const upcoming = filteredCitas.filter((c) => !c.deletedInSheet && new Date(c.startTime) >= today).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return upcoming[0] ?? null;
  }, [filteredCitas, selectedId]);

  const sheetUrl = sheetStatus?.connection ? `https://docs.google.com/spreadsheets/d/${sheetStatus.connection.spreadsheetId}/edit${sheetStatus.connection.sheetGid ? `#gid=${sheetStatus.connection.sheetGid}` : ""}` : null;

  return (
    <div className="flex flex-col gap-4">
      <AgendaSheetConnectPanel key={panelKey} open={panelOpen} onClose={() => setPanelOpen(false)} status={sheetStatus} onSynced={afterSync} />

      {/* Encabezado compacto — título + estado de sync a la izquierda, selector Citas/Leads +
          Nueva cita a la derecha, todo en una línea (desktop). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold text-foreground">Agenda</h1>
            <ModuleHelp
              compact
              description="La Agenda te permite organizar tus próximas citas y seguimientos — llegan solas desde tu hoja conectada, nunca se cargan a mano acá."
              tourKey="agenda-intro"
            />
          </div>
          {sheetStatus === null ? (
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-surface-2" />
          ) : sheetStatus.connection ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-neutral-500">
              {sheetStatus.connection.lastSyncStatus === "error" ? (
                <AlertTriangle className="size-3.5 text-error-strong" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-success-strong" aria-hidden="true" />
              )}
              <span>{sheetStatus.connection.lastSyncStatus === "error" ? "Error al sincronizar" : "Sincronizado con Google Sheets"}</span>
              <span className="text-neutral-300">·</span>
              <span>{sheetStatus.connection.lastSyncedAt ? `hace ${formatMinutesAgo(sheetStatus.connection.lastSyncedAt)}` : "todavía no"}</span>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                title="Sincronizar ahora"
                aria-label="Sincronizar ahora"
                className="ml-0.5 flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
              >
                {syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
              </button>
              {sheetUrl && (
                <a href={sheetUrl} target="_blank" rel="noreferrer" title="Abrir hoja" aria-label="Abrir hoja" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={openPanel} title="Configurar" aria-label="Configurar" className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground">
                <Settings2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={openPanel} className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent-600 hover:text-accent-700">
              <FileSpreadsheet className="size-3.5" aria-hidden="true" />
              Conectá tu hoja de agendas para empezar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1" role="tablist" aria-label="Vista de la agenda">
            {(["citas", "leads"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-[13px] font-medium ${view === v ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"}`}
              >
                {v === "citas" ? "Citas" : "Leads"}
              </button>
            ))}
          </div>
          {view === "citas" && (
            <div className="relative">
              <button
                type="button"
                data-tour="agenda.new-cita-button"
                onClick={() => setNewCitaOpen((v) => !v)}
                className="flex h-11 items-center gap-1.5 rounded-md bg-accent-500 px-4 text-[13px] font-medium text-white hover:bg-accent-600"
              >
                <Plus size={15} aria-hidden="true" />
                Nueva cita
              </button>
              {newCitaOpen && (
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border-default bg-surface-1 p-3.5 shadow-[var(--elevation-md)]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                      <FileSpreadsheet size={14} className="text-accent-600" aria-hidden="true" />
                      Las citas vienen de tu hoja
                    </p>
                    <button type="button" onClick={() => setNewCitaOpen(false)} className="text-neutral-400 hover:text-foreground">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mb-3 text-[12.5px] text-neutral-500">
                    Para no duplicar la carga, Agenda no crea citas manualmente — cargá la cita en tu hoja de Google Sheets conectada y tocá Sincronizar ahora.
                  </p>
                  <button type="button" data-tour="agenda.sheet-connect-link" onClick={openPanel} className="text-[12.5px] font-medium text-accent-600 hover:text-accent-700">
                    {sheetStatus?.connection ? "Configurar mi hoja de agendas →" : "Conectar hoja de agendas →"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {view === "leads" ? (
        <AgendaLeadsSection refreshKey={refreshKey} />
      ) : (
        <>
          <AgendaFunnelStrip citas={citas ?? []} />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-full bg-surface-2 p-1" data-tour="agenda.range-switcher">
                {GRANULARITY_OPTIONS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGranularity(g.key)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      granularity === g.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <span className="text-[13.5px] font-medium text-foreground">{periodLabel(granularity, selectedDate)}</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                  title="Ir a una fecha"
                  className="flex size-8 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                >
                  <CalendarSearch size={14} aria-hidden="true" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="pointer-events-none absolute inset-0 opacity-0"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const [y, m, d] = e.target.value.split("-").map(Number);
                    setGranularity("dia");
                    setSelectedDate(new Date(y, m - 1, d));
                  }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2" data-tour="agenda.filters-button">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono"
                aria-label="Buscar por nombre o teléfono"
                className="w-full max-w-[220px] rounded-md border border-border-strong bg-surface-1 px-3 py-1.5 text-[13px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <select
                value={setterFilter}
                onChange={(e) => setSetterFilter(e.target.value)}
                aria-label="Filtrar por setter"
                className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px] text-foreground"
              >
                <option value="">Setter: Todos</option>
                {setterOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value as EstadoCita | "")}
                aria-label="Filtrar por estado"
                className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px] text-foreground"
              >
                <option value="">Estado: Todos</option>
                {ESTADO_CITA_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_CITA_META[e].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              {loading && !citas ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Cargando agenda…
                </div>
              ) : (
                <AgendaCitasList citas={filteredCitas} selectedId={selectedCita?.id ?? null} onSelect={(c) => setSelectedId(c.id)} onAgendarClick={openPanel} />
              )}
            </div>
            <div className="lg:sticky lg:top-4 lg:self-start">
              <AgendaCitaDetailPanel cita={selectedCita} canEdit onEstadoChanged={handleEstadoChanged} sheetUrl={sheetUrl} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatMinutesAgo(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "un momento";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return `${Math.round(diffH / 24)} d`;
}
