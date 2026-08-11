"use client";

import { useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  CalendarClock,
  CalendarDays,
  FileCheck2,
  ListTodo,
  DollarSign,
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Users2,
  CalendarX2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import type { ClientListItem } from "@/lib/clients/queries";
import type { ClientAlertType } from "@/lib/clients/alerts";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getClientsListAction } from "@/lib/clients/actions";
import { NewClientWizard } from "./NewClientWizard";
import { ClientCard } from "./ClientCard";
import { ClientListRow } from "./ClientListRow";

type StatusFilter = "all" | "en_onboarding" | "activo" | "pausado" | "archivado";
type AlertFilter = "all" | ClientAlertType;

export function ClientesListShell({
  initialClients,
  members,
  moduleEnabled,
}: {
  initialClients: ClientListItem[];
  members: WorkspaceMemberOption[];
  moduleEnabled: boolean;
}) {
  const [clients, setClients] = useState(initialClients);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountManagerFilter, setAccountManagerFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  async function refetch() {
    setClients(await getClientsListAction());
  }

  const memberNameById = useMemo(() => new Map(members.map((m) => [m.memberId, m.fullName])), [members]);

  const metrics = useMemo(() => {
    const activos = clients.filter((c) => c.status === "activo").length;
    const citasMes = clients.reduce((sum, c) => sum + c.citasMesCount, 0);
    const polizasMes = clients.reduce((sum, c) => sum + c.polizasMesCount, 0);
    const mrr = clients
      .filter((c) => c.status === "activo" && c.activeContract?.monthlyValue)
      .reduce((sum, c) => sum + (c.activeContract?.monthlyValue ?? 0), 0);
    // Los 4 conteos de alerta salen de client.alertTypes (getClientsList,
    // mismas reglas que el banner del perfil — ver alerts.ts) en vez de
    // recalcularse acá con criterios propios, para que el número de esta
    // card y el filtro que dispara al tocarla siempre coincidan.
    const countByAlert = (type: ClientAlertType) => clients.filter((c) => c.alertTypes.includes(type)).length;
    return {
      activos,
      contratosPorVencer: countByAlert("contract_expiring"),
      citasMes,
      polizasMes,
      tareasPendientes: countByAlert("tasks_pending"),
      sinCitasRecientes: countByAlert("no_recent_activity"),
      pagoPendiente: countByAlert("payment_pending"),
      mrr,
    };
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (accountManagerFilter !== "all" && c.accountManagerId !== accountManagerFilter) return false;
      if (alertFilter !== "all" && !c.alertTypes.includes(alertFilter)) return false;
      if (q && !c.contactName.toLowerCase().includes(q) && !(c.company ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, statusFilter, accountManagerFilter, alertFilter]);

  function toggleAlertFilter(type: ClientAlertType) {
    setAlertFilter((current) => (current === type ? "all" : type));
  }

  if (!moduleEnabled) {
    return (
      <EmptyState
        icon={Users}
        title="El módulo Clientes no está activo"
        description="Activalo desde tu perfil, en Configuración > Módulos, para empezar a gestionar tus clientes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} aria-hidden="true" />
          Nuevo cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no hay clientes"
          description="Creá el primero vinculando un contacto existente o cargando uno nuevo."
          action={<Button onClick={() => setShowCreate(true)}>Nuevo cliente</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MetricCard icon={UserCheck} label="Clientes activos" value={String(metrics.activos)} />
            <MetricCard icon={CalendarDays} label="Citas este mes" value={String(metrics.citasMes)} />
            <MetricCard icon={FileCheck2} label="Pólizas este mes" value={String(metrics.polizasMes)} />
            <MetricCard icon={DollarSign} label="MRR activo" value={`USD ${metrics.mrr.toLocaleString("es-MX")}`} />
          </div>

          {/* Las 4 alertas — clickeables como quick-filter, mismo criterio
           * (alertTypes) que dispara el banner del perfil de cada cliente. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={CalendarClock}
              label="Contratos x vencer"
              value={String(metrics.contratosPorVencer)}
              onClick={() => toggleAlertFilter("contract_expiring")}
              active={alertFilter === "contract_expiring"}
            />
            <MetricCard
              icon={ListTodo}
              label="Tareas pendientes"
              value={String(metrics.tareasPendientes)}
              onClick={() => toggleAlertFilter("tasks_pending")}
              active={alertFilter === "tasks_pending"}
            />
            <MetricCard
              icon={CalendarX2}
              label="Sin citas recientes"
              value={String(metrics.sinCitasRecientes)}
              onClick={() => toggleAlertFilter("no_recent_activity")}
              active={alertFilter === "no_recent_activity"}
            />
            <MetricCard
              icon={Wallet}
              label="Pago pendiente"
              value={String(metrics.pagoPendiente)}
              onClick={() => toggleAlertFilter("payment_pending")}
              active={alertFilter === "payment_pending"}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar clientes…"
                className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-accent-500"
            >
              <option value="all">Filtrar por estado</option>
              <option value="en_onboarding">En onboarding</option>
              <option value="activo">Activos</option>
              <option value="pausado">Pausados</option>
              <option value="archivado">Archivados</option>
            </select>
            <select
              value={accountManagerFilter}
              onChange={(e) => setAccountManagerFilter(e.target.value)}
              className="rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-accent-500"
            >
              <option value="all">Account Manager</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-1 rounded-full bg-surface-2 p-1">
              <button
                type="button"
                aria-label="Vista de cuadrícula"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                className={`flex size-7 items-center justify-center rounded-full ${layout === "grid" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
              >
                <LayoutGrid size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Vista de lista"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                className={`flex size-7 items-center justify-center rounded-full ${layout === "list" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500"}`}
              >
                <ListIcon size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-2 p-10 text-center">
              <Users2 className="size-6 text-neutral-400" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">Sin resultados</p>
              <p className="text-xs text-neutral-500">Probá con otro término de búsqueda o filtro.</p>
            </div>
          ) : layout === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((client) => (
                <ClientCard key={client.id} client={client} accountManagerName={client.accountManagerId ? memberNameById.get(client.accountManagerId) : undefined} onChanged={refetch} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((client) => (
                <ClientListRow key={client.id} client={client} accountManagerName={client.accountManagerId ? memberNameById.get(client.accountManagerId) : undefined} onChanged={refetch} />
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && <NewClientWizard onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
