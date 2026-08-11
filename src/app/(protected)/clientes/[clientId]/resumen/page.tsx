import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, FileCheck2, DollarSign, Link2, MessageSquare } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientProfile, getClientContracts, getClientPolicies, getClientAppointments } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MetricCard } from "@/components/responseSummary/MetricCard";

export const metadata: Metadata = { title: "Resumen — Cliente — Growth Link" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  linkedin_leadgen: "Growth Link LinkedIn",
  crm: "Growth Link CRM",
  ambos: "Growth Link Hybrid",
  otro: "Otro",
};

export default async function ClientResumenPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();

  const [client, contracts, policies, appointments, members] = await Promise.all([
    getClientProfile(workspaceId, clientId),
    getClientContracts(workspaceId, clientId),
    getClientPolicies(workspaceId, clientId),
    getClientAppointments(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
  ]);
  if (!client) return null;

  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const activeContract = contracts.find((c) => c.status === "activo") ?? contracts[0] ?? null;

  const totalDays = activeContract ? Math.round((new Date(activeContract.endDate).getTime() - new Date(activeContract.startDate).getTime()) / 86400000) : 0;
  const elapsedDays = activeContract ? Math.max(0, Math.round((new Date().getTime() - new Date(activeContract.startDate).getTime()) / 86400000)) : 0;
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const shows = appointments.filter((a) => a.attended === true).length;
  const showRate = appointments.length > 0 ? Math.round((shows / appointments.length) * 100) : 0;
  const totalCommission = policies.reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0);
  const investment = activeContract?.amountPaid ?? 0;
  const roi = investment > 0 ? totalCommission / investment : null;

  return (
    <div className="flex flex-col gap-4">
      {activeContract && (
        <Card>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-neutral-500">Inicio</p>
              <p className="font-medium text-foreground">{formatDate(activeContract.startDate)}</p>
            </div>
            <div className="text-center">
              <p className="text-neutral-500">Progreso</p>
              <p className="font-medium text-foreground">
                {elapsedDays} / {totalDays} días
              </p>
            </div>
            <div className="text-right">
              <p className="text-neutral-500">Fin</p>
              <p className="font-medium text-foreground">{formatDate(activeContract.endDate)}</p>
            </div>
          </div>
          <ProgressBar value={progressPct} className="mt-3" />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={CalendarDays} label="Citas generadas" value={String(appointments.length)} />
        <MetricCard icon={CheckCircle2} label="Show rate" value={`${showRate}%`} />
        <MetricCard icon={FileCheck2} label="Pólizas vendidas" value={String(policies.length)} />
        <MetricCard icon={DollarSign} label="Valor generado" value={`USD ${totalCommission.toLocaleString("es-MX")}`} />
        {roi !== null && <MetricCard icon={DollarSign} label="ROI del cliente" value={`${roi.toFixed(2)}x`} />}
        <MetricCard icon={Link2} label="Conexiones LinkedIn" value="—" />
        <MetricCard icon={MessageSquare} label="Conversaciones" value="—" />
      </div>

      <Card>
        <CardHeader title="Información del cliente" />
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Nombre completo</dt>
            <dd className="font-medium text-foreground">{client.contactName}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Empresa / firma</dt>
            <dd className="font-medium text-foreground">{client.company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Profesión</dt>
            <dd className="font-medium text-foreground">{client.profession ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Aseguradora</dt>
            <dd className="font-medium text-foreground">{client.insurer ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">País</dt>
            <dd className="font-medium text-foreground">{client.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Ciudad</dt>
            <dd className="font-medium text-foreground">{client.city ?? "—"}</dd>
          </div>
          {activeContract && (
            <>
              <div>
                <dt className="text-neutral-500">Fecha de inicio</dt>
                <dd className="font-medium text-foreground">{formatDate(activeContract.startDate)}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Fecha de finalización</dt>
                <dd className="font-medium text-foreground">{formatDate(activeContract.endDate)}</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-neutral-500">Tipo de servicio</dt>
            <dd className="font-medium text-foreground">{SERVICE_TYPE_LABEL[client.serviceType] ?? client.serviceType}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Setter asignado</dt>
            <dd className="font-medium text-foreground">{client.setterId ? (nameById.get(client.setterId) ?? "—") : "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Traffic Manager</dt>
            <dd className="font-medium text-foreground">{client.trafficManagerId ? (nameById.get(client.trafficManagerId) ?? "—") : "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Account Manager</dt>
            <dd className="font-medium text-foreground">{client.accountManagerId ? (nameById.get(client.accountManagerId) ?? "—") : "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
