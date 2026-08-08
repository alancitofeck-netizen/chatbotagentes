import { CheckCircle2, Circle } from "lucide-react";

/** mini_app_leads.consentimiento es boolean not null, y el pipeline de
 * ingesta (ingest.ts) rechaza el lead si no viene en true — en la práctica
 * todo lead que existe ya tiene consentimiento aceptado. Se muestra el
 * estado real (aceptado/no aceptado) — no se inventa un tercer estado
 * "rechazado" que el modelo de datos no contempla. */
export function ConsentStatus({ accepted, fecha }: { accepted: boolean; fecha: string }) {
  return (
    <div className={`rounded-xl border p-3.5 ${accepted ? "border-success-strong/30 bg-success-strong/10" : "border-white/10 bg-white/5"}`}>
      <p className={`text-[11px] font-medium tracking-wide uppercase ${accepted ? "text-[#7CE7B0]" : "text-white/50"}`}>Consentimiento (LFPDPPP)</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-white">
        {accepted ? <CheckCircle2 className="size-4 text-[#7CE7B0]" aria-hidden="true" /> : <Circle className="size-4 text-white/40" aria-hidden="true" />}
        {accepted ? "Aceptado" : "No aceptado"} — {new Date(fecha).toLocaleString("es")}
      </p>
    </div>
  );
}
