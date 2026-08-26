import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AgentAdvisorInfo, AgentReferralActivityStats } from "@/lib/ai-agents/queries";
import type { ReferralStats } from "@/lib/ai-agents/suggestionAnalysis";
import { REFERRAL_STATUS_LABEL } from "@/app/(protected)/asesorias/referidos/referralStatus";
import type { ReferralStatus } from "@/lib/asesorias/referrals";

const PIPELINE_ORDER: ReferralStatus[] = ["nuevo", "contactado", "interesado", "no_interesado", "convertido"];

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="font-mono text-xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

/** Panel persistente del detalle de un agente de referidos con asesor
 * asignado (moduleKey==='referrals' && advisorId) — todos los números vienen
 * ya calculados server-side (page.tsx), acá solo se muestran. El pipeline
 * mapea a los 5 estados reales de asesoria_referrals — no hay más etapas
 * que estas en el esquema. */
export function AgentStatsPanel({
  advisorInfo,
  activityStats,
  pipeline,
}: {
  advisorInfo: AgentAdvisorInfo | null;
  activityStats: AgentReferralActivityStats | null;
  pipeline: ReferralStats | null;
}) {
  const maxStage = pipeline ? Math.max(1, ...PIPELINE_ORDER.map((s) => pipeline.byStatus[s])) : 1;

  return (
    <div className="flex flex-col gap-4">
      {activityStats && (
        <Card>
          <CardHeader title="Estadísticas del agente" />
          <p className="mb-3 text-xs text-neutral-500">Últimos 14 días</p>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Conversaciones activas" value={activityStats.conversacionesActivas} />
            <StatTile label="Mensajes enviados" value={activityStats.mensajesEnviados} />
            <StatTile label="Respuestas recibidas" value={activityStats.respuestasRecibidas} />
            <StatTile label="Tasa de respuesta" value={activityStats.tasaRespuestaPct !== null ? `${activityStats.tasaRespuestaPct}%` : "—"} />
            <StatTile label="Citas generadas" value={activityStats.citasGeneradas} />
            <StatTile label="Conversión a cita" value={activityStats.conversionACitaPct !== null ? `${activityStats.conversionACitaPct}%` : "—"} />
            <StatTile label="Seguimientos realizados" value={activityStats.seguimientosRealizados} />
          </div>
        </Card>
      )}

      {pipeline && (
        <Card>
          <CardHeader title="Pipeline del referido" />
          <p className="mb-3 text-xs text-neutral-500">{pipeline.total} referidos en total</p>
          <div className="flex flex-col gap-3">
            {PIPELINE_ORDER.map((status) => {
              const count = pipeline.byStatus[status];
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-neutral-600">{REFERRAL_STATUS_LABEL[status]}</span>
                    <span className="font-mono text-foreground">{count}</span>
                  </div>
                  <ProgressBar value={(count / maxStage) * 100} variant={status === "convertido" ? "success" : status === "no_interesado" ? "error" : "accent"} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {advisorInfo && (
        <Card>
          <CardHeader title="Agente asignado" />
          <div className="flex items-center gap-3">
            <Avatar name={advisorInfo.fullName} src={advisorInfo.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{advisorInfo.fullName}</p>
              <p className="truncate text-xs capitalize text-neutral-500">{advisorInfo.role}</p>
              <p className="truncate text-xs text-neutral-400">{advisorInfo.email}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
