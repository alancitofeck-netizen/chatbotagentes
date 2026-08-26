import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Clock } from "lucide-react";
import type { AgentFollowupRow } from "@/lib/ai-agents/queries";

const STATUS_LABEL: Record<AgentFollowupRow["status"], string> = { pending: "Pendiente", sent: "Enviado", cancelled: "Cancelado" };
const STATUS_VARIANT: Record<AgentFollowupRow["status"], "accent" | "success" | "neutral"> = { pending: "accent", sent: "success", cancelled: "neutral" };

const MAX_FOLLOWUP_ATTEMPTS = 3;

/** Solo lectura — referral_followups no tenía ninguna pantalla propia hasta
 * ahora. No hay umbrales configurables (24h/72h/etc): el propio agente
 * decide cuánto esperar en cada schedule_followup, este tope de intentos es
 * el único valor fijo real (scheduleFollowup.ts). Cada seguimiento vencido
 * se resuelve como una tarea asignada al asesor (api/cron/referral-followups),
 * no como un mensaje automático — por eso no hay acciones acá. */
export function FollowupsTab({ followups }: { followups: AgentFollowupRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm text-neutral-500">
          El agente decide cuánto esperar antes de cada reintento — no hay una cadencia fija configurable. Tope de{" "}
          <span className="font-medium text-foreground">{MAX_FOLLOWUP_ATTEMPTS} intentos</span> por referido. Un seguimiento vencido sin respuesta se
          convierte en una tarea asignada al asesor (no se envía ningún mensaje automático).
        </p>
      </Card>

      {followups.length === 0 ? (
        <EmptyState icon={Clock} title="Sin seguimientos programados" description="Los seguimientos que el agente programe van a aparecer acá." />
      ) : (
        <Card>
          <CardHeader title="Seguimientos" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-neutral-500">
                  <th className="pb-2 pr-3 font-medium">Referido</th>
                  <th className="pb-2 pr-3 font-medium">Intento</th>
                  <th className="pb-2 pr-3 font-medium">Programado</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {followups.map((f) => (
                  <tr key={f.id} className="border-b border-border-default last:border-b-0">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-foreground">{f.referralName}</p>
                      <p className="text-xs text-neutral-500">{f.referralPhone}</p>
                    </td>
                    <td className="py-2 pr-3 text-neutral-600">
                      {f.attemptNumber}/{MAX_FOLLOWUP_ATTEMPTS}
                    </td>
                    <td className="py-2 pr-3 text-neutral-500">{new Date(f.scheduledAt).toLocaleString("es")}</td>
                    <td className="py-2">
                      <Badge variant={STATUS_VARIANT[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
