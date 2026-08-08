import { Gauge, Phone, User } from "lucide-react";
import type { MiniAppLeadRow } from "@/lib/miniApps/queries";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "./leadStatus";

/** Tarjeta de lead para el listado de una Mini App (LeadsTab) — mismo
 * lenguaje visual que ResponseSummaryScreen (ver src/components/
 * responseSummary/), pero vive acá porque el shape que dibuja (nombre +
 * badges + score opcional) es específico de un lead de Mini App, no algo
 * reusable por Asesorías. El score/perfil solo se muestra si `data` ya lo
 * trae — nunca se calcula acá (siempre viene del recompute autoritativo de
 * ingest.ts). */
export function MiniAppLeadCard({ lead, onClick }: { lead: MiniAppLeadRow; onClick: () => void }) {
  const score = typeof lead.data.score === "number" ? lead.data.score : null;
  const perfil = typeof lead.data.level === "string" ? lead.data.level : typeof lead.data.perfil === "string" ? lead.data.perfil : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-2 p-4 text-left transition-colors hover:bg-surface-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
            <User className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{lead.nombre}</p>
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              <Phone className="size-3" aria-hidden="true" />
              {lead.whatsapp}
            </p>
          </div>
        </div>
        <StatusBadge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {lead.agente && <StatusBadge variant="neutral">{lead.agente}</StatusBadge>}
        <span className="text-xs text-neutral-500">{new Date(lead.fecha).toLocaleDateString("es")}</span>
        {score !== null && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-700">
            <Gauge className="size-3" aria-hidden="true" />
            {score}/100{perfil ? ` · ${perfil}` : ""}
          </span>
        )}
      </div>
    </button>
  );
}
