"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { MiniAppLeadDetail } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import {
  getMiniAppLeadDetailAction,
  convertMiniAppLeadToContact,
  moveMiniAppLeadToPipeline,
  assignMiniAppLeadAdvisor,
  startMiniAppLeadConversation,
} from "@/lib/miniApps/actions";

const FIELD_LABELS: Record<string, string> = {
  edad: "Edad",
  edad_retiro: "Edad de retiro",
  ahorro_mensual: "Ahorro mensual",
  ingreso_actual: "Ingreso actual",
  fondo_estimado: "Fondo estimado",
  fondo_rango_bajo: "Fondo (rango bajo)",
  fondo_rango_alto: "Fondo (rango alto)",
  renta_mensual_estimada: "Renta mensual estimada",
  email: "Correo electrónico",
  score: "Puntaje",
  level: "Nivel",
  areas: "Desglose por área",
  answers: "Respuestas (índices)",
};

function formatValue(value: unknown): string {
  if (typeof value === "number") return new Intl.NumberFormat("es-MX").format(value);
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "object" && v !== null ? Object.values(v).join(" ") : String(v))).join(", ");
  }
  return String(value);
}

export function LeadDetailDrawer({
  leadId,
  members,
  onClose,
  onChanged,
}: {
  leadId: string;
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<MiniAppLeadDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMiniAppLeadDetailAction(leadId).then(setLead);
  }, [leadId]);

  function refresh() {
    getMiniAppLeadDetailAction(leadId).then(setLead);
    onChanged();
  }

  function handleConvert() {
    startTransition(async () => {
      try {
        await convertMiniAppLeadToContact(leadId);
        toast.success("Lead convertido a contacto.");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo convertir el lead.");
      }
    });
  }

  function handleMoveToPipeline() {
    startTransition(async () => {
      try {
        await moveMiniAppLeadToPipeline(leadId);
        toast.success("Lead movido al Pipeline.");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo mover el lead al pipeline.");
      }
    });
  }

  function handleAssign(ownerId: string) {
    startTransition(async () => {
      try {
        await assignMiniAppLeadAdvisor(leadId, ownerId || null);
        toast.success("Asesor asignado.");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo asignar el asesor.");
      }
    });
  }

  function handleStartConversation() {
    startTransition(async () => {
      try {
        const result = await startMiniAppLeadConversation(leadId);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Conversación abierta en el Inbox.");
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo iniciar la conversación.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={lead?.nombre ?? "Lead"}>
      {!lead ? (
        <div className="p-5 text-sm text-neutral-500">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{lead.origenApp}</Badge>
            {lead.agente && <Badge variant="neutral">{lead.agente}</Badge>}
            <Badge variant={lead.status === "converted" ? "success" : lead.status === "discarded" ? "error" : "neutral"}>
              {lead.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">WhatsApp</p>
              <p className="text-foreground">{lead.whatsapp}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Fecha</p>
              <p className="text-foreground">{new Date(lead.fecha).toLocaleString("es")}</p>
            </div>
          </div>

          <div className="rounded-md border border-border-default bg-surface-2 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Consentimiento (LFPDPPP)</p>
            <p className="mt-1 text-foreground">
              {lead.consentimiento ? "Aceptado" : "No aceptado"} — {new Date(lead.consentimientoFecha).toLocaleString("es")}
            </p>
          </div>

          {Object.keys(lead.data).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Datos de la simulación</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {Object.entries(lead.data).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-neutral-500">{FIELD_LABELS[key] ?? key}</dt>
                    <dd className="text-foreground">{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="my-1 h-px bg-border-default" />

          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={handleConvert} loading={isPending} disabled={!!lead.contactId}>
              {lead.contactId ? "Ya es Contacto" : "Convertir a Contacto"}
            </Button>
            <Button variant="secondary" onClick={handleMoveToPipeline} loading={isPending} disabled={!!lead.opportunityId}>
              {lead.opportunityId ? "Ya está en el Pipeline" : "Mover a Pipeline"}
            </Button>
            <Select
              label="Asignar asesor"
              value=""
              onChange={(e) => e.target.value && handleAssign(e.target.value)}
              disabled={!lead.opportunityId || isPending}
            >
              <option value="">{lead.opportunityId ? "Elegir asesor…" : "Primero mové el lead al Pipeline"}</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={handleStartConversation} loading={isPending}>
              Iniciar conversación
            </Button>
            <Link href="/inbox" className="text-center text-xs text-accent-600 hover:underline">
              Ver en el Inbox
            </Link>
          </div>
        </div>
      )}
    </Sheet>
  );
}
