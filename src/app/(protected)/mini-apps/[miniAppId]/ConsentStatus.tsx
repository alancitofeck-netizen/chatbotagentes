import { CheckCircle2, Circle } from "lucide-react";

/** mini_app_leads.consentimiento es boolean not null, y el pipeline de
 * ingesta (ingest.ts) rechaza el lead si no viene en true — en la práctica
 * todo lead que existe ya tiene consentimiento aceptado. Se muestra el
 * estado real (aceptado/no aceptado) — no se inventa un tercer estado
 * "rechazado" que el modelo de datos no contempla. */
export function ConsentStatus({ accepted, fecha }: { accepted: boolean; fecha: string }) {
  return (
    <div className={`rounded-xl border p-3.5 ${accepted ? "border-success-strong/30 bg-success-strong/10" : "border-border-default bg-surface-2"}`}>
      <p className={`text-[11px] font-medium tracking-wide uppercase ${accepted ? "text-success-strong" : "text-neutral-400"}`}>Consentimiento (LFPDPPP)</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
        {accepted ? <CheckCircle2 className="size-4 text-success-strong" aria-hidden="true" /> : <Circle className="size-4 text-neutral-400" aria-hidden="true" />}
        {accepted ? "Aceptado" : "No aceptado"} — {new Date(fecha).toLocaleString("es")}
      </p>
    </div>
  );
}
