import type { Metadata } from "next";
import { FileText, Download, CalendarClock } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import {
  getClientProfile,
  getClientContracts,
  getClientPolicies,
  getClientAppointments,
  getClientTimeline,
  getClientConversationsCount,
  getClientNotes,
} from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getDownloadUrl } from "@/lib/documents/actions";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreGauge } from "@/components/responseSummary/ScoreGauge";
import { ClientTimelineList } from "../../ClientTimelineList";
import { DeltaLabel } from "../../DeltaLabel";
import { ResumenSideCardEdit } from "./ResumenSideCardEdit";
import { bucketByDay, monthOverMonthDelta } from "@/lib/clients/statsHelpers";

export const metadata: Metadata = { title: "Resumen — Cliente — Growth Link" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  linkedin_leadgen: "Growth Link LinkedIn",
  crm: "Growth Link CRM",
  ambos: "Growth Link Hybrid",
  otro: "Otro",
};

const CONTRACT_STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  borrador: { label: "Borrador", variant: "neutral" },
  activo: { label: "Activo", variant: "success" },
  vencido: { label: "Vencido", variant: "error" },
  renovado: { label: "Renovado", variant: "info" },
  cancelado: { label: "Cancelado", variant: "neutral" },
};

export default async function ClientResumenPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();

  const client = await getClientProfile(workspaceId, clientId);
  if (!client) return null;

  const [contracts, policies, appointments, members, timeline, conversationsCount, notes] = await Promise.all([
    getClientContracts(workspaceId, clientId),
    getClientPolicies(workspaceId, clientId),
    getClientAppointments(workspaceId, clientId),
    getWorkspaceMembers(workspaceId),
    getClientTimeline(workspaceId, clientId),
    client.contactId ? getClientConversationsCount(workspaceId, client.contactId) : Promise.resolve(0),
    getClientNotes(workspaceId, clientId),
  ]);

  const nameById = new Map(members.map((m) => [m.memberId, m.fullName]));
  const activeContract = contracts.find((c) => c.status === "activo") ?? contracts[0] ?? null;

  const totalDays = activeContract ? Math.max(1, Math.round((new Date(activeContract.endDate).getTime() - new Date(activeContract.startDate).getTime()) / 86400000)) : 0;
  const elapsedDays = activeContract ? daysSince(activeContract.startDate) : 0;
  const daysRemaining = Math.max(0, totalDays - elapsedDays);
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const shows = appointments.filter((a) => a.attended === true).length;
  const showRate = appointments.length > 0 ? Math.round((shows / appointments.length) * 100) : 0;
  const totalCommission = policies.reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0);

  const appointmentDates = appointments.map((a) => a.startTime);
  const policyDates = policies.filter((p) => p.issueDate).map((p) => p.issueDate as string);
  const documentUrl = activeContract?.documentId ? await getDownloadUrl(activeContract.documentId) : null;
  const latestNote = notes[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Card className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">Días de contrato restantes</p>
          <p className="text-2xl font-semibold text-foreground">{activeContract ? daysRemaining : "—"}</p>
          {activeContract && (
            <>
              <ProgressBar value={progressPct} />
              <p className="text-xs text-neutral-500">
                Inicio: {formatDate(activeContract.startDate)} · Fin: {formatDate(activeContract.endDate)}
              </p>
              <p className="text-xs text-neutral-500">
                {elapsedDays} / {totalDays} días
              </p>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">Citas generadas</p>
              <p className="text-2xl font-semibold text-foreground">{appointments.length}</p>
            </div>
            {appointments.length > 0 && <Sparkline data={bucketByDay(appointmentDates, 14)} color="var(--color-accent-500)" />}
          </div>
          <DeltaLabel pct={monthOverMonthDelta(appointmentDates)} />
        </Card>

        <Card className="flex flex-col items-center gap-1">
          <p className="self-start text-xs text-neutral-500">Show rate</p>
          <ScoreGauge score={showRate} />
        </Card>

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">Pólizas vendidas</p>
              <p className="text-2xl font-semibold text-foreground">{policies.length}</p>
            </div>
            {policies.length > 0 && <Sparkline data={bucketByDay(policyDates, 14)} color="var(--color-success-strong)" />}
          </div>
          <DeltaLabel pct={monthOverMonthDelta(policyDates)} />
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">Valor generado</p>
          <p className="text-2xl font-semibold text-foreground">USD {totalCommission.toLocaleString("es-MX")}</p>
          <DeltaLabel pct={monthOverMonthDelta(policyDates)} />
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">Conexiones LinkedIn</p>
          <p className="text-2xl font-semibold text-foreground">—</p>
          <p className="text-xs text-neutral-500">Sin integración conectada</p>
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="text-xs text-neutral-500">Conversaciones</p>
          <p className="text-2xl font-semibold text-foreground">{conversationsCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Información del cliente" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm">
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

        <Card>
          <CardHeader title="Contrato" />
          {!activeContract ? (
            <p className="text-sm text-neutral-500">Este cliente todavía no tiene un contrato cargado.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-neutral-500">Fecha de inicio</p>
                  <p className="font-medium text-foreground">{formatDate(activeContract.startDate)}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Fecha de finalización</p>
                  <p className="font-medium text-foreground">{formatDate(activeContract.endDate)}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Duración</p>
                  <p className="font-medium text-foreground">{totalDays} días</p>
                </div>
                <div>
                  <p className="text-neutral-500">Valor contratado</p>
                  <p className="font-medium text-foreground">{activeContract.totalValue !== null ? `${activeContract.currency} ${activeContract.totalValue.toLocaleString("es-MX")}` : "—"}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Monto pagado</p>
                  <p className="font-medium text-foreground">{activeContract.amountPaid !== null ? `${activeContract.currency} ${activeContract.amountPaid.toLocaleString("es-MX")}` : "—"}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Saldo pendiente</p>
                  <p className="font-medium text-foreground">
                    {activeContract.totalValue !== null
                      ? `${activeContract.currency} ${(activeContract.totalValue - (activeContract.amountPaid ?? 0)).toLocaleString("es-MX")}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-neutral-500">Modelo de comisión</p>
                <p className="font-medium text-foreground">{activeContract.commissionModel ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-neutral-500">Estado:</p>
                <Badge variant={CONTRACT_STATUS_META[activeContract.status].variant}>{CONTRACT_STATUS_META[activeContract.status].label}</Badge>
              </div>
              {documentUrl && (
                <a href={documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-3">
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  Contrato adjunto
                  <Download className="ml-auto size-3.5 text-neutral-400" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Calendly" action={<ResumenSideCardEdit client={client} members={members} />} />
            {client.calendlyUrl ? (
              <div className="flex flex-col gap-2">
                <a href={client.calendlyUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-accent-600 hover:underline">
                  {client.calendlyUrl}
                </a>
                <a
                  href={client.calendlyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-1.5 rounded-full border border-border-default px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2"
                >
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Abrir Calendly
                </a>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Sin Calendly cargado.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="LinkedIn" action={<ResumenSideCardEdit client={client} members={members} />} />
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-neutral-500">Perfil</dt>
                <dd className="truncate">{client.linkedinProfileUrl ? <a href={client.linkedinProfileUrl} target="_blank" rel="noreferrer" className="text-accent-600 hover:underline">{client.linkedinProfileUrl}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-500">Sales Navigator</dt>
                <dd className="truncate">
                  {client.linkedinSalesNavigatorUrl ? (
                    <a href={client.linkedinSalesNavigatorUrl} target="_blank" rel="noreferrer" className="text-accent-600 hover:underline">
                      {client.linkedinSalesNavigatorUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Cuenta utilizada</dt>
                <dd className="font-medium text-foreground">{client.contactEmail ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Notas internas"
              action={
                <a href={`/asesores/${clientId}/contrato`} className="text-xs font-medium text-accent-600 hover:underline">
                  Editar
                </a>
              }
            />
            {latestNote ? <p className="text-sm text-foreground">{latestNote.body}</p> : <p className="text-sm text-neutral-500">Sin notas todavía.</p>}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Timeline" />
        <ClientTimelineList events={timeline} nameById={nameById} emptyMessage="Todavía no hay actividad registrada para este cliente." />
      </Card>
    </div>
  );
}
