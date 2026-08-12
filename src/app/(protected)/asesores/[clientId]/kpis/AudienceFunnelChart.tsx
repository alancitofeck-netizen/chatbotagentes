import { Card, CardHeader } from "@/components/ui/Card";
import type { ClientAudienceFunnel } from "@/lib/clients/queries";

/** "Embudo de citas": Contactos → Conversaciones → Interesados → Citas
 * generadas → Show, con datos 100% reales (getClientAudienceFunnel).
 * "Interesados" depende de bookings.resultado, cargado a mano desde Agenda
 * — arranca en 0 hasta que se etiquete, nunca se estima. */
export function AudienceFunnelChart({ funnel }: { funnel: ClientAudienceFunnel }) {
  const stages = [
    { label: "Contactos", value: funnel.contactos },
    { label: "Conversaciones", value: funnel.conversaciones },
    { label: "Interesados", value: funnel.interesados },
    { label: "Citas generadas", value: funnel.citasGeneradas },
    { label: "Show", value: funnel.show },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <Card>
      <CardHeader title="Embudo de citas" />
      <div className="flex flex-col gap-3">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs text-neutral-500">{s.label}</span>
            <div className="h-6 flex-1 rounded-md bg-surface-2">
              <div className="h-full rounded-md bg-accent-500" style={{ width: `${Math.max(4, Math.round((s.value / max) * 100))}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs text-foreground">{s.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        &ldquo;Interesados&rdquo; se calcula a partir del Resultado que se carga cita por cita en la pestaña Agenda — si todavía no cargaste ninguno, este escalón empieza en 0.
      </p>
    </Card>
  );
}
