"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AsesoriaListItem } from "@/lib/asesorias/queries";
import { getClientAsesoriaDetailAction } from "@/lib/clients/operacionActions";
import { normalizeAsesoriaResponses } from "@/components/responseSummary/normalizeAsesoriaResponses";
import { ResponseSectionCard } from "@/components/responseSummary/ResponseSectionCard";
import { NextStepCard } from "@/components/responseSummary/NextStepCard";
import type { ResponseViewModel } from "@/components/responseSummary/types";
import { ASESORIA_STATUS_LABEL, ASESORIA_STATUS_VARIANT, formatAsesoriaDuration } from "./operacionHelpers";

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

/** Detalle de solo lectura de una Asesoría del asesor — sin link "ver
 * detalle completo" hacia /asesorias/[id]/resumen a propósito: esa ruta
 * resuelve contra el workspace ACTIVO de la sesión, no acepta un workspaceId
 * por parámetro, así que llevaría al admin a ver su propio workspace (vacío
 * o equivocado) en vez del asesor. Todo se muestra acá adentro. */
export function AsesoriaDetailSheet({ clientId, asesoria, onClose }: { clientId: string; asesoria: AsesoriaListItem; onClose: () => void }) {
  const [models, setModels] = useState<ResponseViewModel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClientAsesoriaDetailAction(clientId, asesoria.id).then((result) => {
      if (cancelled) return;
      setModels(result ? normalizeAsesoriaResponses(result.responses) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId, asesoria.id]);

  const sections: { name: string; rows: ResponseViewModel[] }[] = [];
  for (const model of models ?? []) {
    const name = model.section ?? "General";
    let group = sections.find((s) => s.name === name);
    if (!group) {
      group = { name, rows: [] };
      sections.push(group);
    }
    group.rows.push(model);
  }
  for (const group of sections) group.rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nextStep = models?.find((m) => m.answerType === "next_step");

  return (
    <Sheet open onClose={onClose} title={asesoria.contactName ?? asesoria.name} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <Badge variant={ASESORIA_STATUS_VARIANT[asesoria.status]}>{ASESORIA_STATUS_LABEL[asesoria.status]}</Badge>

        <div>
          <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Información general</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Cliente" value={asesoria.contactName ?? "Sin contacto"} />
            <InfoRow label="Fecha" value={formatDateTime(asesoria.startedAt)} />
            <InfoRow label="Duración" value={formatAsesoriaDuration(asesoria.startedAt, asesoria.completedAt, asesoria.updatedAt)} />
            <InfoRow label="Asesor" value={asesoria.advisorName ?? "Sin asignar"} />
            <InfoRow label="Sesión" value={asesoria.templateName ?? "—"} />
            <InfoRow label="Estado" value={ASESORIA_STATUS_LABEL[asesoria.status]} />
          </div>
        </div>

        {models === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : models.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay respuestas registradas para esta asesoría.</p>
        ) : (
          <>
            <div>
              <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Respuestas principales</h3>
              <div className="flex flex-col gap-3">
                {sections.map((s) => (
                  <ResponseSectionCard key={s.name} section={s.name} models={s.rows} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[13px] font-semibold text-neutral-500 uppercase tracking-wide">Próximo paso</h3>
              <NextStepCard nextStep={nextStep} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
