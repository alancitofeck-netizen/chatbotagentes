"use client";

import { useRouter } from "next/navigation";
import { Table as TableIcon, Umbrella } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ProspectListItem } from "@/lib/insuranceProspects/queries";
import { PROSPECT_STATUS_OPTIONS, type ProspectStatus } from "@/lib/insuranceProspects/statusOptions";

const STATUS_BADGE_VARIANT: Record<ProspectStatus, BadgeVariant> = {
  nuevo: "info",
  pendiente_contacto: "warning",
  informacion_incompleta: "warning",
  en_analisis: "accent",
  cotizacion_enviada: "accent",
  negociacion: "accent",
  poliza_emitida: "success",
  rechazada: "error",
  archivada: "neutral",
};

function statusLabel(status: ProspectStatus) {
  return PROSPECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function PosiblesPolizasListShell({
  initialProspects,
  moduleEnabled,
}: {
  initialProspects: ProspectListItem[];
  moduleEnabled: boolean;
}) {
  const router = useRouter();

  if (!moduleEnabled) {
    return (
      <EmptyState
        icon={Umbrella}
        title="El módulo Posibles Pólizas no está activo"
        description="Activalo desde tu perfil, en Configuración > Módulos, para empezar a capturar prospectos de seguro."
      />
    );
  }

  if (initialProspects.length === 0) {
    return (
      <EmptyState
        icon={TableIcon}
        title="Todavía no hay posibles pólizas"
        description="Este listado se completa solo cuando alguien envía una Mini App, calculadora o formulario pidiendo cotizar un seguro."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            <th className="px-3 py-2.5 font-medium">Nombre</th>
            <th className="px-3 py-2.5 font-medium">Edad</th>
            <th className="px-3 py-2.5 font-medium">Ocupación</th>
            <th className="px-3 py-2.5 font-medium">Estado civil</th>
            <th className="px-3 py-2.5 font-medium">¿Fuma?</th>
            <th className="px-3 py-2.5 font-medium">Ciudad</th>
            <th className="px-3 py-2.5 font-medium">Asesor</th>
            <th className="px-3 py-2.5 font-medium">Creado</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {initialProspects.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/posibles-polizas/${p.id}`)}
              className="cursor-pointer border-b border-border-default last:border-0 hover:bg-surface-2"
            >
              <td className="px-3 py-2.5 font-medium text-foreground">{p.fullName}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.age ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.occupation ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.maritalStatus ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.smoker === null ? "—" : p.smoker ? "Sí" : "No"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.city ?? "—"}</td>
              <td className="px-3 py-2.5 text-neutral-600">{p.ownerAgentName ?? "Sin asignar"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500">{formatDate(p.createdAt)}</td>
              <td className="px-3 py-2.5">
                <Badge variant={STATUS_BADGE_VARIANT[p.status]}>{statusLabel(p.status)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
