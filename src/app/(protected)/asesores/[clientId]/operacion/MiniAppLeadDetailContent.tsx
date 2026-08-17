"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import type { ClientMiniAppLeadDetail } from "@/lib/clients/operacion";
import { getClientMiniAppLeadDetailAction } from "@/lib/clients/operacionActions";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { ResponseSectionCard } from "@/components/responseSummary/ResponseSectionCard";
import type { ResponseViewModel } from "@/components/responseSummary/types";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "../../../mini-apps/[miniAppId]/leadStatus";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/** Detalle DINÁMICO de un lead de Mini App — nunca hardcodea qué campos
 * mostrar: normalizeMiniAppLeadResponses (ya usado por la pantalla real
 * /mini-apps/[id]/leads/[leadId]/resumen) proyecta lo que sea que esa Mini
 * App puntual haya guardado en `data` (jsonb schema-less), con fallback
 * genérico para cualquier template/campo no reconocido. No es un `<Sheet>`
 * propio: se monta DENTRO del Sheet de MiniAppLeadsSheet (swap de contenido,
 * no un drawer apilado sobre otro). */
export function MiniAppLeadDetailContent({ clientId, leadId }: { clientId: string; leadId: string }) {
  const [detail, setDetail] = useState<ClientMiniAppLeadDetail | null | undefined>(undefined);
  const [models, setModels] = useState<ResponseViewModel[]>([]);

  useEffect(() => {
    let cancelled = false;
    getClientMiniAppLeadDetailAction(clientId, leadId).then((result) => {
      if (cancelled) return;
      setDetail(result);
      setModels(result ? normalizeMiniAppLeadResponses(result.lead, result.miniApp) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, leadId]);

  if (detail === undefined) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (detail === null) {
    return <p className="p-5 text-sm text-neutral-500">No se pudo cargar este lead.</p>;
  }

  const { lead, miniApp } = detail;

  const sections: { name: string; rows: ResponseViewModel[] }[] = [];
  for (const model of models) {
    const name = model.section ?? "General";
    let group = sections.find((s) => s.name === name);
    if (!group) {
      group = { name, rows: [] };
      sections.push(group);
    }
    group.rows.push(model);
  }
  for (const group of sections) group.rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="flex flex-col gap-5 p-5">
      <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Origen</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Mini App" value={miniApp?.name ?? lead.origenApp} />
          <InfoRow label="Asesor" value={lead.agente ?? "—"} />
          <InfoRow label="Fecha" value={formatDateTime(lead.receivedAt)} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Información personal</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Nombre" value={lead.nombre} />
          <InfoRow label="WhatsApp" value={lead.whatsapp} />
        </div>
      </div>

      {sections.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Respuestas</h3>
          <div className="flex flex-col gap-3">
            {sections.map((s) => (
              <ResponseSectionCard key={s.name} section={s.name} models={s.rows} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
