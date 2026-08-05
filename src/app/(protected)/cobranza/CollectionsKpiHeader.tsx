"use client";

import { CheckCircle2, AlertTriangle, CalendarClock, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { CollectionsKpis } from "@/lib/collections/queries";
import { formatCurrency } from "@/lib/utils/format";
import type { CollectionsQuickFilter } from "./collectionsFilters";

function KpiTile({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  sublabel,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  sublabel?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <span className={cn("flex size-10 items-center justify-center rounded-full", iconBg, iconColor)}>{icon}</span>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
        {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
      </div>
    </>
  );

  if (!onClick) {
    return <Card className="flex flex-col gap-3">{content}</Card>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-surface-1 p-5 text-left shadow-[var(--elevation-sm)] transition-all duration-150 ease-out hover:shadow-[var(--elevation-md)]",
        active && "ring-2 ring-accent-500",
      )}
    >
      {content}
    </button>
  );
}

/** 3 tarjetas — "a quién le toca pagar cada día", no un dashboard financiero
 * completo (eso vive en las otras vistas: Tabla/Kanban/Prioridad). Las 3 son
 * clickeables (filtran la lista); las 5 restantes que existían antes (Total
 * pendiente, Prima mensual/anual, Tasa efectiva, Comisión generada) se
 * sacaron del header por pedido explícito de simplificar esta pantalla —
 * los números siguen calculándose en getCollectionsKpis por si una vista
 * futura los necesita, solo dejaron de mostrarse acá. */
export function CollectionsKpiHeader({
  kpis,
  quickFilter,
  onQuickFilterChange,
}: {
  kpis: CollectionsKpis;
  quickFilter: CollectionsQuickFilter;
  onQuickFilterChange: (next: CollectionsQuickFilter) => void;
}) {
  function toggle(next: CollectionsQuickFilter) {
    onQuickFilterChange(quickFilter === next ? "all" : next);
  }

  const changePct = kpis.collectedThisMonthChangePct;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiTile
        icon={<CalendarClock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-info-bg"
        iconColor="text-info-strong"
        value={formatCurrency(kpis.upcoming7Amount)}
        label="Por cobrar esta semana"
        sublabel={`${kpis.upcoming7Count} póliza${kpis.upcoming7Count === 1 ? "" : "s"}`}
        onClick={() => toggle("upcoming")}
        active={quickFilter === "upcoming"}
      />
      <KpiTile
        icon={<AlertTriangle className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-error-bg"
        iconColor="text-error-strong"
        value={formatCurrency(kpis.overdueAmount)}
        label="En riesgo (vencidas)"
        sublabel={`${kpis.overdueCount} póliza${kpis.overdueCount === 1 ? "" : "s"} · contactar ya`}
        onClick={() => toggle("overdue")}
        active={quickFilter === "overdue"}
      />
      <KpiTile
        icon={<CheckCircle2 className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-success-bg"
        iconColor="text-success-strong"
        value={formatCurrency(kpis.collectedThisMonth)}
        label="Cobrado este mes"
        sublabel={
          changePct === null ? undefined : (
            <span className={cn("inline-flex items-center gap-0.5", changePct >= 0 ? "text-success-strong" : "text-error-strong")}>
              {changePct >= 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
              {Math.abs(changePct)}% vs. mes anterior
            </span>
          )
        }
        onClick={() => toggle("paidThisMonth")}
        active={quickFilter === "paidThisMonth"}
      />
    </div>
  );
}
