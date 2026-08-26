import { Lock, Check, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

const CAN = ["Puede iniciar conversaciones con referidos.", "Puede responder sus mensajes.", "Puede realizar seguimiento."];
const CANNOT = ["No puede procesar contactos normales del CRM.", "No puede guardar mensajes no autorizados.", "No puede iniciar conversaciones fuera de la lista de referidos."];

/** Solo Referidos — informativo, sin ningún control editable. La whitelist
 * real vive en src/lib/messaging/referralAuthorization.ts, gatea el webhook
 * de WhatsApp ANTES de crear cualquier contacto/conversación — acá no se
 * toca ni se re-implementa nada, solo se explica con el número real. */
export function StepSource({ referralCount }: { referralCount: number }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="¿Con quién puede trabajar este agente?" />
        <div className="rounded-lg border border-accent-500/30 bg-accent-50 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Lock className="size-4 text-accent-700" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Referidos CRM</p>
          </div>
          <p className="mb-1 font-mono text-xs text-neutral-600">asesoria_referrals</p>
          <p className="text-sm text-neutral-700">
            Este agente solamente puede trabajar con contactos autorizados por el módulo de Referidos de Growth Link.
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">Actualmente hay {referralCount} referido{referralCount === 1 ? "" : "s"} autorizado{referralCount === 1 ? "" : "s"} en este workspace.</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <ul className="flex flex-col gap-1.5">
              {CAN.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success-strong" aria-hidden="true" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ul className="flex flex-col gap-1.5">
              {CANNOT.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-neutral-500">
                  <X className="mt-0.5 size-4 shrink-0 text-error-strong" aria-hidden="true" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-4 text-xs text-neutral-400">Esta fuente no se puede modificar para un agente de referidos.</p>
      </Card>
    </div>
  );
}
