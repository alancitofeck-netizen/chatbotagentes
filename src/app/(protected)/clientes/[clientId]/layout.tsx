import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2, CalendarCheck, MessageCircle, FileText, AlertTriangle, OctagonAlert } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getClientProfile } from "@/lib/clients/queries";
import { getClientAlerts } from "@/lib/clients/alerts";
import { recomputeAndCacheClientHealth } from "@/lib/clients/health";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShieldAlert } from "lucide-react";
import { TabLink } from "@/components/ui/Tabs";
import { HEALTH_LABEL_META } from "../clientHealthMeta";

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isHealthScoreStale(healthScoreUpdatedAt: string | null): boolean {
  if (!healthScoreUpdatedAt) return true;
  return Date.now() - new Date(healthScoreUpdatedAt).getTime() > STALE_AFTER_MS;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  en_onboarding: { label: "En onboarding", className: "bg-info-bg text-info-strong" },
  activo: { label: "Activo", className: "bg-success-strong/15 text-success-strong" },
  pausado: { label: "Pausado", className: "bg-warning-bg text-warning-strong" },
  archivado: { label: "Archivado", className: "bg-surface-3 text-neutral-500" },
};

const TABS = [
  { href: "resumen", label: "Resumen" },
  { href: "operacion", label: "Operación" },
  { href: "kpis", label: "KPIs" },
  { href: "agenda", label: "Agenda" },
  { href: "tareas", label: "Tareas" },
  { href: "polizas", label: "Pólizas" },
  { href: "accesos", label: "Accesos" },
  { href: "documentos", label: "Documentos" },
  { href: "contrato", label: "Contrato" },
];

/** Fase 1: acceso restringido a owner/admin en TODO el módulo — mismo
 * criterio que clientes/page.tsx. Un solo fetch de perfil acá; cada
 * pestaña (children) trae solo lo que le corresponde. */
export default async function ClientProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId, role } = await requireActiveWorkspace();

  if (role !== "owner" && role !== "admin") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState icon={ShieldAlert} title="Acceso restringido" description="Este módulo es solo para owners y admins del workspace." />
      </div>
    );
  }

  await assertModuleEnabled(workspaceId, "clientes");
  let client = await getClientProfile(workspaceId, clientId);
  if (!client) notFound();

  // Fallback perezoso del Health Score: si nunca se calculó o quedó
  // desactualizado (>24h), se recalcula acá mismo antes de renderizar —
  // el cron diario (recompute-health-scores) es la vía normal, esto solo
  // cubre el hueco entre que se crea un cliente y la primera corrida del
  // cron, o si el cron se saltó una noche.
  if (isHealthScoreStale(client.healthScoreUpdatedAt)) {
    await recomputeAndCacheClientHealth(workspaceId, clientId);
    client = await getClientProfile(workspaceId, clientId);
    if (!client) notFound();
  }

  const alerts = await getClientAlerts(workspaceId, clientId);
  const status = STATUS_META[client.status];
  const health = client.healthScoreLabel ? HEALTH_LABEL_META[client.healthScoreLabel] : null;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/clientes" className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a Clientes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar name={client.contactName} src={client.contactAvatarUrl} size={48} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] leading-[28px] font-semibold tracking-[-0.02em] text-foreground">{client.contactName}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                {health && (
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${health.className}`}>
                    <span className={`size-1.5 rounded-full ${health.dot}`} aria-hidden="true" />
                    {health.label}
                    {client.healthScore !== null && ` · ${client.healthScore}`}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500">
                {client.profession ?? "Sin profesión"}
                {client.company ? ` — ${client.company}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {client.linkedinProfileUrl && (
              <a
                href={client.linkedinProfileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                LinkedIn
              </a>
            )}
            {client.calendlyUrl && (
              <a
                href={client.calendlyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                <CalendarCheck className="size-3.5" aria-hidden="true" />
                Calendly
              </a>
            )}
            {client.contactPhone && (
              <a
                href={`https://wa.me/${client.contactPhone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                WhatsApp
              </a>
            )}
            <Link
              href={`/clientes/${clientId}/contrato`}
              className="flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              Contrato
            </Link>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => {
              const Icon = alert.severity === "critical" ? OctagonAlert : AlertTriangle;
              const className = alert.severity === "critical" ? "border-error/40 bg-error-bg text-error-strong" : "border-warning/40 bg-warning-bg text-warning-strong";
              return (
                <div key={alert.type} className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${className}`}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {alert.message}
                </div>
              );
            })}
          </div>
        )}

        <div role="tablist" className="flex flex-wrap gap-5 overflow-x-auto border-b border-border-default">
          {TABS.map((tab) => (
            <TabLink key={tab.href} href={`/clientes/${clientId}/${tab.href}`}>
              {tab.label}
            </TabLink>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
