"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users, ChevronRight, MessageCircle, CalendarClock, Download, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Fab } from "@/components/ui/Fab";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import { getAgendaLeadsAction } from "@/lib/agenda/sheetPanelActions";
import type { AgendaLead } from "@/lib/agenda/sheetPanelTypes";
import type { EstadoCita } from "@/lib/agenda/queries";
import { ETAPA_META, ETAPA_TAB_OPTIONS, computeEtapa, type Etapa } from "@/lib/agenda/etapa";
import { titleCaseName, formatPhoneDisplay, extractEmailFromText } from "@/lib/utils/format";
import { AgendaLeadDetailPanel } from "./AgendaLeadDetailPanel";
import { AgendaRecordForm, type AgendaRecordFormRecord } from "./AgendaRecordForm";

const SOURCE_LABELS: Record<string, string> = {
  agenda_sheet: "Agenda de setters",
  google_sheets: "Hoja del asesor",
  mini_app: "Mini App",
  whatsapp: "WhatsApp",
  manychat: "ManyChat",
  instagram: "Instagram",
  asesoria: "Asesoría",
  asesoria_referral: "Referido",
};

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

function isNewLead(l: AgendaLead): boolean {
  if (!l.createdAt || l.contactado) return false;
  return Date.now() - new Date(l.createdAt).getTime() < 48 * 3600 * 1000;
}

function citaCellInfo(l: AgendaLead): { date: string; sub: string | null; subClassName: string } {
  const iso = l.nextCitaAt ?? l.lastCitaAt;
  if (!iso) return { date: "—", sub: null, subClassName: "" };
  const date = new Date(iso);
  const dateLabel = date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  if (l.nextCitaAt) {
    const days = Math.round((date.getTime() - Date.now()) / 86400000);
    const sub = days <= 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`;
    return { date: dateLabel, sub, subClassName: "text-neutral-500" };
  }
  if (l.lastEstado === "realizada" || l.lastEstado === "venta" || l.lastEstado === "propuesta") return { date: dateLabel, sub: "Asistió", subClassName: "text-success-strong" };
  if (l.lastEstado === "agendada") return { date: dateLabel, sub: "Pasó, sin resultado", subClassName: "text-[#9A4D00]" };
  if (l.lastEstado === "no_show") return { date: dateLabel, sub: "No asistió", subClassName: "text-error-strong" };
  if (l.lastEstado === "cancelada") return { date: dateLabel, sub: "Cancelada", subClassName: "text-neutral-500" };
  return { date: dateLabel, sub: null, subClassName: "" };
}

function exportCsv(leads: AgendaLead[]) {
  const headers = ["Nombre", "Teléfono", "Email", "Producto", "Etapa", "Cita", "Setter", "Fuente", "Notas"];
  const rows = leads.map((l) => {
    const etapa = ETAPA_META[computeEtapa(l)].label;
    const cita = l.nextCitaAt ?? l.lastCitaAt ?? "";
    const email = l.email ?? extractEmailFromText(l.notas) ?? "";
    return [
      titleCaseName(l.name),
      l.phone ? formatPhoneDisplay(l.phone) : "",
      email,
      l.producto ?? "",
      etapa,
      cita,
      l.setterName ?? "",
      (l.source ? (SOURCE_LABELS[l.source] ?? l.source) : ""),
      (l.notas ?? "").replace(/\n/g, " "),
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-agenda-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function leadToRecord(lead: AgendaLead): AgendaRecordFormRecord | null {
  if (!lead.appointmentId || !lead.appointmentWorkspaceId) return null;
  return {
    appointmentId: lead.appointmentId,
    appointmentWorkspaceId: lead.appointmentWorkspaceId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    producto: lead.producto,
    appointmentType: lead.appointmentType,
    setterName: lead.setterName,
    notas: lead.notas,
    estadoCita: lead.lastEstado ?? "agendada",
    startTime: lead.nextCitaAt ?? lead.lastCitaAt ?? new Date().toISOString(),
    sinHora: lead.sinHora,
    fromSheet: lead.fromSheet,
  };
}

/** Agenda → Leads: cada persona con citas en la agenda, agrupada por etapa (calculada —
 * src/lib/agenda/etapa.ts) en vez de la vieja tabla plana. Un componente, no dos: `compact`
 * decide tabla+panel (escritorio) vs tarjetas+pantalla completa (mobile), pero la carga de datos,
 * los filtros y las acciones de escritura son el mismo código en los dos casos (pedido explícito:
 * "es UNA sola página responsive"). */
export function AgendaLeadsSection({ refreshKey, compact = false }: { refreshKey: number; compact?: boolean }) {
  const [leads, setLeads] = useState<AgendaLead[] | null>(null);
  const [tab, setTab] = useState<"todos" | Etapa>("todos");
  const [search, setSearch] = useState("");
  const [producto, setProducto] = useState("");
  const [fuente, setFuente] = useState("");
  const [sort, setSort] = useState<"recent" | "old">("recent");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  const [screenVisible, setScreenVisible] = useState(false);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AgendaRecordFormRecord | null>(null);

  function openCreate() {
    setEditingRecord(null);
    setRecordSheetOpen(true);
  }
  function openEdit(lead: AgendaLead) {
    const record = leadToRecord(lead);
    if (!record) {
      toast.info("Este lead no tiene una cita cargada", "No se puede editar todavía.");
      return;
    }
    setEditingRecord(record);
    setRecordSheetOpen(true);
  }

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
  }, [refreshKey, localRefreshKey]);

  useEffect(() => {
    if (screenOpen) {
      const raf = requestAnimationFrame(() => setScreenVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    // Diferido a un microtask (no una llamada sync dentro del efecto) — mismo truco que ya usa
    // Sheet.tsx para esta misma transición de apertura/cierre.
    Promise.resolve().then(() => setScreenVisible(false));
  }, [screenOpen]);

  function handleEstadoChanged(contactId: string, estado: EstadoCita) {
    setLeads((prev) => (prev ? prev.map((l) => (l.contactId === contactId ? { ...l, lastEstado: estado } : l)) : prev));
  }
  function handleNotasChanged(contactId: string, notas: string) {
    setLeads((prev) => (prev ? prev.map((l) => (l.contactId === contactId ? { ...l, notas } : l)) : prev));
  }

  const productos = useMemo(() => [...new Set((leads ?? []).map((l) => l.producto).filter((p): p is string => !!p))].sort(), [leads]);
  const fuentes = useMemo(() => [...new Set((leads ?? []).map((l) => l.source).filter((s): s is string => !!s))].sort(), [leads]);

  const counts = useMemo(() => {
    const map = new Map<Etapa, number>();
    for (const l of leads ?? []) {
      const etapa = computeEtapa(l);
      map.set(etapa, (map.get(etapa) ?? 0) + 1);
    }
    return map;
  }, [leads]);
  const sinResultadoCount = counts.get("sin_resultado") ?? 0;

  const filtered = useMemo(() => {
    let rows = leads ?? [];
    if (tab !== "todos") rows = rows.filter((l) => computeEtapa(l) === tab);
    if (producto) rows = rows.filter((l) => l.producto === producto);
    if (fuente) rows = rows.filter((l) => l.source === fuente);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((l) => `${l.name} ${l.phone ?? ""} ${l.notas ?? ""}`.toLowerCase().includes(q));
    return [...rows].sort((a, b) => (sort === "recent" ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "") : (a.createdAt ?? "").localeCompare(b.createdAt ?? "")));
  }, [leads, tab, producto, fuente, search, sort]);

  const selectedLead = filtered.find((l) => l.contactId === selectedContactId) ?? leads?.find((l) => l.contactId === selectedContactId) ?? null;

  function selectLead(id: string) {
    setSelectedContactId(id);
    if (compact) setScreenOpen(true);
  }
  function closeScreen() {
    setScreenVisible(false);
    setTimeout(() => setScreenOpen(false), 220);
  }

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

  const tabButtons: { key: "todos" | Etapa; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: leads.length },
    ...ETAPA_TAB_OPTIONS.map((e) => ({ key: e, label: ETAPA_META[e].label, count: counts.get(e) ?? 0 })),
  ];

  const avisoBanner = sinResultadoCount > 0 && tab !== "sin_resultado";

  // ───────────────────────── Mobile (compact) ─────────────────────────
  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {mobileSearchOpen ? (
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setMobileSearchOpen(false)}
                placeholder="Nombre, teléfono o nota"
                aria-label="Buscar lead"
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface-1 py-2 pr-3 pl-9 text-[15px] text-foreground outline-none focus:border-accent-500"
              />
            </label>
          ) : (
            <>
              <h2 className="flex-1 text-[15px] font-semibold text-foreground">
                Leads <span className="text-neutral-400 tabular-nums">{leads.length}</span>
              </h2>
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                aria-label="Buscar"
                className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border-default text-neutral-500"
              >
                <Search size={17} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist">
          {tabButtons.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap ${tab === t.key ? "bg-[#0F1B22] text-white" : "bg-surface-2 text-neutral-600"}`}
            >
              {t.label} <span className="tabular-nums opacity-80">{t.count}</span>
            </button>
          ))}
        </div>

        {avisoBanner && (
          <button
            type="button"
            onClick={() => setTab("sin_resultado")}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#F3DDB8] bg-[#FFF6E6] px-3.5 py-3 text-left"
          >
            <span className="text-[13px] text-[#7A4A00]">
              <strong>{sinResultadoCount} leads</strong> tuvieron cita y no tienen resultado
            </span>
            <ChevronRight size={16} className="shrink-0 text-[#7A4A00]" aria-hidden="true" />
          </button>
        )}

        <div className="flex flex-col gap-2.5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Sin leads para este filtro.</p>
          ) : (
            filtered.map((l) => {
              const etapa = computeEtapa(l);
              const etapaMeta = ETAPA_META[etapa];
              const cita = citaCellInfo(l);
              const displayName = titleCaseName(l.name);
              return (
                <article
                  key={l.contactId}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectLead(l.contactId)}
                  className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3.5"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={displayName} size={36} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium text-foreground">{displayName}</span>
                        {isNewLead(l) && <span className="shrink-0 rounded bg-success-strong px-1.5 py-px text-[9px] font-semibold tracking-wide text-white">NUEVO</span>}
                      </p>
                      <p className="truncate text-[12px] text-neutral-500">{l.phone ? formatPhoneDisplay(l.phone) : "—"}</p>
                    </div>
                    <Badge variant={etapaMeta.variant} className="shrink-0">
                      {etapaMeta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12.5px] text-neutral-600">
                    {l.producto && <Badge variant={PRODUCTO_VARIANT[l.producto] ?? "neutral"}>{l.producto}</Badge>}
                    {cita.date !== "—" && (
                      <span>
                        Cita <strong>{cita.date}</strong>
                        {cita.sub ? <span className={cita.subClassName}> · {cita.sub.toLowerCase()}</span> : null}
                      </span>
                    )}
                  </div>
                  {l.notas && <p className="truncate text-[12.5px] text-neutral-500">{l.notas}</p>}
                  <div className="-mx-3.5 mt-1 flex gap-2 border-t border-border-default px-3.5 pt-2.5">
                    {l.phone && (
                      <a
                        href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default text-[13px] font-medium text-foreground"
                      >
                        <MessageCircle size={15} aria-hidden="true" /> WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectLead(l.contactId);
                      }}
                      className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-default text-[13px] font-medium text-foreground"
                    >
                      <CalendarClock size={15} aria-hidden="true" /> {etapa === "sin_resultado" ? "Cargar resultado" : "Agendar"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <Fab onClick={openCreate} aria-label="Nuevo lead" />

        {/* Pantalla completa de la ficha, con deslizamiento tipo iOS */}
        {screenOpen && selectedLead && (
          <div
            className={`fixed inset-0 z-50 flex flex-col bg-surface-1 transition-transform duration-[220ms] ease-[var(--ease-out)] ${screenVisible ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex items-center justify-between border-b border-border-default px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
              <button type="button" onClick={closeScreen} className="flex h-11 items-center gap-1 text-[14px] font-medium text-accent-600">
                <ChevronRight size={18} className="rotate-180" aria-hidden="true" /> Leads
              </button>
              <button type="button" onClick={() => openEdit(selectedLead)} aria-label="Editar lead" className="flex size-11 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2">
                <Pencil size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-10" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
              <div className="pt-4">
                <AgendaLeadDetailPanel key={selectedLead.contactId} lead={selectedLead} onEstadoChanged={handleEstadoChanged} onNotasChanged={handleNotasChanged} showHistorial showLlamar />
              </div>
            </div>
          </div>
        )}

        <Sheet open={recordSheetOpen} onClose={() => setRecordSheetOpen(false)} title={editingRecord ? (editingRecord.fromSheet ? "Editar cita" : "Editar lead") : "Nuevo lead"}>
          <AgendaRecordForm
            key={editingRecord?.appointmentId ?? "new"}
            record={editingRecord}
            onClose={() => setRecordSheetOpen(false)}
            onSaved={() => setLocalRefreshKey((k) => k + 1)}
          />
        </Sheet>
      </div>
    );
  }

  // ───────────────────────── Desktop ─────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabButtons.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === t.key ? "bg-[#0F1B22] text-white" : "bg-surface-2 text-neutral-600 hover:bg-surface-2/70"}`}
          >
            {t.label} <span className="tabular-nums opacity-80">{t.count}</span>
          </button>
        ))}
      </div>

      {avisoBanner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F3DDB8] bg-[#FFF6E6] px-4 py-2.5">
          <span className="flex items-center gap-2 text-[13px] text-[#7A4A00]">
            <CalendarClock size={15} aria-hidden="true" />
            <strong>{sinResultadoCount} leads</strong> tuvieron cita y no tienen resultado cargado.
          </span>
          <button type="button" onClick={() => setTab("sin_resultado")} className="shrink-0 rounded-md bg-[#0F1B22] px-3 py-1.5 text-[12.5px] font-medium text-white">
            Ver y actualizar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-3">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, teléfono o nota"
                aria-label="Buscar lead"
                className="w-64 max-w-full rounded-md border border-border-strong bg-surface-1 py-1.5 pr-2.5 pl-8 text-[13px]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select value={producto} onChange={(e) => setProducto(e.target.value)} aria-label="Filtrar por producto" className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px]">
                <option value="">Producto: Todos</option>
                {productos.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select value={fuente} onChange={(e) => setFuente(e.target.value)} aria-label="Filtrar por fuente" className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px]">
                <option value="">Fuente: Todas</option>
                {fuentes.map((f) => (
                  <option key={f} value={f}>
                    {SOURCE_LABELS[f] ?? f}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as "recent" | "old")} aria-label="Orden" className="rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-[13px]">
                <option value="recent">Orden: Más reciente</option>
                <option value="old">Orden: Más antiguo</option>
              </select>
              <button type="button" onClick={() => exportCsv(filtered)} className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2">
                <Download size={14} aria-hidden="true" /> Exportar
              </button>
              <button type="button" onClick={openCreate} className="flex h-9 items-center gap-1.5 rounded-md bg-accent-500 px-3.5 text-[13px] font-medium text-white hover:bg-accent-600">
                + Nuevo lead
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">Sin leads para este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="text-left text-[12px] text-neutral-500">
                  <tr className="border-b border-border-default">
                    {["Lead", "Producto", "Etapa", "Cita", "Última nota", "Acciones"].map((h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((l) => {
                    const etapa = computeEtapa(l);
                    const etapaMeta = ETAPA_META[etapa];
                    const cita = citaCellInfo(l);
                    const displayName = titleCaseName(l.name);
                    const selected = l.contactId === selectedContactId;
                    return (
                      <tr
                        key={l.contactId}
                        onClick={() => selectLead(l.contactId)}
                        className={`cursor-pointer border-b border-border-default last:border-b-0 ${selected ? "bg-[#EEF7F8] shadow-[inset_3px_0_0_0_var(--color-accent-500)]" : "hover:bg-surface-2"}`}
                      >
                        <td className="max-w-[240px] px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={displayName} size={30} className="shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-medium text-foreground">{displayName}</span>
                                {isNewLead(l) && <span className="shrink-0 rounded bg-success-strong px-1.5 py-px text-[9px] font-semibold tracking-wide text-white">NUEVO</span>}
                              </div>
                              <span className="truncate text-[12px] text-neutral-500">{l.phone ? formatPhoneDisplay(l.phone) : "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{l.producto ? <Badge variant={PRODUCTO_VARIANT[l.producto] ?? "neutral"}>{l.producto}</Badge> : <span className="text-neutral-400">—</span>}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={etapaMeta.variant}>{etapaMeta.label}</Badge>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div>{cita.date}</div>
                          {cita.sub && <div className={`text-[11.5px] ${cita.subClassName}`}>{cita.sub}</div>}
                        </td>
                        <td className="max-w-[200px] px-3 py-2.5">
                          <span className="block truncate text-neutral-600" title={l.notas ?? undefined}>
                            {l.notas ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            {l.phone && (
                              <a
                                href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`WhatsApp a ${displayName}`}
                                className="flex size-9 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                              >
                                <MessageCircle size={15} aria-hidden="true" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => selectLead(l.contactId)}
                              aria-label="Agendar cita"
                              className="flex size-9 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                            >
                              <CalendarClock size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border-default px-4 py-2.5 text-[12.5px] text-neutral-500">
            <span>
              Mostrando {Math.min(visible, filtered.length)} de {filtered.length}
            </span>
            {filtered.length > visible && (
              <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="font-medium text-accent-600 hover:text-accent-700">
                Cargar más
              </button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border-default bg-surface-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Ficha del lead</p>
              {selectedLead && (
                <button type="button" onClick={() => openEdit(selectedLead)} className="flex items-center gap-1 text-[12.5px] font-medium text-accent-600 hover:text-accent-700">
                  <Pencil size={13} aria-hidden="true" /> Editar
                </button>
              )}
            </div>
            {selectedLead ? (
              <AgendaLeadDetailPanel key={selectedLead.contactId} lead={selectedLead} onEstadoChanged={handleEstadoChanged} onNotasChanged={handleNotasChanged} />
            ) : (
              <p className="py-10 text-center text-[13px] text-neutral-500">Elegí un lead de la lista para ver su ficha acá.</p>
            )}
          </div>
        </div>
      </div>

      <Sheet open={recordSheetOpen} onClose={() => setRecordSheetOpen(false)} title={editingRecord ? (editingRecord.fromSheet ? "Editar cita" : "Editar lead") : "Nuevo lead"}>
        <AgendaRecordForm key={editingRecord?.appointmentId ?? "new"} record={editingRecord} onClose={() => setRecordSheetOpen(false)} onSaved={() => setLocalRefreshKey((k) => k + 1)} />
      </Sheet>
    </div>
  );
}
