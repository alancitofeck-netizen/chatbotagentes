"use client";

import { useMemo, useState } from "react";
import type { ClientAppointment, ClientNote, ClientSetterPerformance } from "@/lib/clients/queries";
import type { AsesoriaListItem } from "@/lib/asesorias/queries";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { ClientOperacionModules, ClientRecentMiniAppLead } from "@/lib/clients/operacion";
import { withinPeriod, downloadCsv, type OperacionPeriod, ASESORIA_STATUS_LABEL } from "./operacionHelpers";
import { OperacionFilters } from "./OperacionFilters";
import { ResumenSubTab } from "./ResumenSubTab";
import { CitasSubTab } from "./CitasSubTab";
import { AsesoriasSubTab } from "./AsesoriasSubTab";
import { ReferidosSubTab } from "./ReferidosSubTab";
import { MiniAppsSubTab } from "./MiniAppsSubTab";
import { REFERRAL_STATUS_LABEL } from "../../../asesorias/referidos/referralStatus";

type SubTab = "resumen" | "citas" | "asesorias" | "referidos" | "miniapps";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "citas", label: "Citas" },
  { key: "asesorias", label: "Asesorías" },
  { key: "referidos", label: "Referidos" },
  { key: "miniapps", label: "Mini Apps" },
];

/** Dueño del estado de filtros/sub-tab de Operación — toda la data ya viene
 * cargada por props desde page.tsx (un solo fetch server-side), así que
 * cambiar de sub-tab/período/búsqueda es instantáneo, sin round-trip. Solo
 * los drawers (detalle de asesoría / leads de una Mini App) hacen fetch
 * on-demand vía Server Actions — ver operacionActions.ts. */
export function OperacionShell({
  clientId,
  appointments,
  notes,
  setters,
  nameById,
  asesorias,
  referrals,
  miniApps,
  recentMiniAppLeads,
  modules,
}: {
  clientId: string;
  appointments: ClientAppointment[];
  notes: ClientNote[];
  setters: ClientSetterPerformance[];
  nameById: Map<string, string>;
  asesorias: AsesoriaListItem[];
  referrals: ReferralRow[];
  miniApps: MiniAppListItem[];
  recentMiniAppLeads: ClientRecentMiniAppLead[];
  modules: ClientOperacionModules;
}) {
  const [subtab, setSubtab] = useState<SubTab>("resumen");
  const [period, setPeriod] = useState<OperacionPeriod>("30d");
  const [search, setSearch] = useState("");
  const searchLower = search.trim().toLowerCase();

  const filteredAppointments = useMemo(() => appointments.filter((a) => withinPeriod(a.startTime, period)), [appointments, period]);

  const filteredAsesorias = useMemo(
    () =>
      asesorias
        .filter((a) => withinPeriod(a.startedAt, period))
        .filter((a) => !searchLower || (a.contactName ?? a.name).toLowerCase().includes(searchLower)),
    [asesorias, period, searchLower],
  );

  const filteredReferrals = useMemo(
    () => referrals.filter((r) => withinPeriod(r.createdAt, period)).filter((r) => !searchLower || r.name.toLowerCase().includes(searchLower)),
    [referrals, period, searchLower],
  );

  // Mini Apps se queda como agregado histórico (getMiniAppsList ya trae
  // leadsCount/lastLeadAt de por vida) — filtrar por período implicaría
  // traer por adelantado los leads de TODAS las mini apps, lo que anula la
  // carga perezosa al abrir "Ver datos" (ver plan). Solo se filtra por nombre.
  const filteredMiniApps = useMemo(
    () => miniApps.filter((app) => !searchLower || app.name.toLowerCase().includes(searchLower)),
    [miniApps, searchLower],
  );

  const searchPlaceholder =
    subtab === "asesorias"
      ? "Buscar cliente…"
      : subtab === "referidos"
        ? "Buscar referido…"
        : subtab === "miniapps"
          ? "Buscar Mini App…"
          : "Buscar cliente, lead, referido…";

  function handleExport() {
    if (subtab === "asesorias") {
      downloadCsv(
        "asesorias.csv",
        ["Cliente", "Estado", "Sesión", "Última actividad", "Fecha inicio"],
        filteredAsesorias.map((a) => [a.contactName ?? a.name, ASESORIA_STATUS_LABEL[a.status], a.templateName ?? "", a.updatedAt, a.startedAt]),
      );
    } else if (subtab === "referidos") {
      downloadCsv(
        "referidos.csv",
        ["Referido", "Teléfono", "De quién viene", "Fecha", "Estado"],
        filteredReferrals.map((r) => [r.name, r.phone, r.asesoriaName, r.createdAt, REFERRAL_STATUS_LABEL[r.status]]),
      );
    } else if (subtab === "miniapps") {
      downloadCsv(
        "mini-apps.csv",
        ["Mini App", "Leads", "Convertidos", "Último lead", "Estado"],
        filteredMiniApps.map((a) => [a.name, a.leadsCount, a.convertedLeadsCount, a.lastLeadAt ?? "", a.status]),
      );
    } else {
      downloadCsv(
        "citas.csv",
        ["Cliente", "Fecha", "Estado", "Show"],
        filteredAppointments.map((a) => [a.contactName ?? "", a.startTime, a.status, a.attended === true ? "Sí" : a.attended === false ? "No" : ""]),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <OperacionFilters
        period={period}
        onPeriodChange={setPeriod}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        onExport={handleExport}
      />

      <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-border-default">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={subtab === tab.key}
            onClick={() => setSubtab(tab.key)}
            className={`shrink-0 border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors ${
              subtab === tab.key ? "border-accent-500 text-foreground" : "border-transparent text-neutral-500 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subtab === "resumen" && (
        <ResumenSubTab
          clientId={clientId}
          appointments={filteredAppointments}
          asesorias={filteredAsesorias}
          referrals={filteredReferrals}
          miniApps={filteredMiniApps}
          recentMiniAppLeads={recentMiniAppLeads}
        />
      )}
      {subtab === "citas" && <CitasSubTab clientId={clientId} appointments={filteredAppointments} setters={setters} notes={notes} nameById={nameById} />}
      {subtab === "asesorias" && <AsesoriasSubTab clientId={clientId} asesorias={filteredAsesorias} moduleEnabled={modules.asesorias} />}
      {subtab === "referidos" && <ReferidosSubTab referrals={filteredReferrals} moduleEnabled={modules.asesorias} />}
      {subtab === "miniapps" && <MiniAppsSubTab clientId={clientId} miniApps={filteredMiniApps} moduleEnabled={modules.miniApps} />}
    </div>
  );
}
