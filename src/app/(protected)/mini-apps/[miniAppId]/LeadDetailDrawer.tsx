"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeftRight, MessageCircle } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import type { MiniAppLeadDetail, MiniAppDetail } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import {
  getMiniAppLeadDetailAction,
  getMiniAppDetailAction,
  convertMiniAppLeadToContact,
  moveMiniAppLeadToPipeline,
  assignMiniAppLeadAdvisor,
  startMiniAppLeadConversation,
} from "@/lib/miniApps/actions";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { SimulationMetricCard } from "@/components/responseSummary/SimulationMetricCard";
import { LeadHeader } from "./LeadHeader";
import { LeadContactCard } from "./LeadContactCard";
import { ConsentStatus } from "./ConsentStatus";
import { LeadActionButton } from "./LeadActionButton";

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
  const [miniApp, setMiniApp] = useState<MiniAppDetail | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getMiniAppLeadDetailAction(leadId).then(setLead);
  }, [leadId]);

  useEffect(() => {
    if (lead?.miniAppId) getMiniAppDetailAction(lead.miniAppId).then(setMiniApp);
  }, [lead?.miniAppId]);

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

  const models = lead ? normalizeMiniAppLeadResponses(lead, miniApp) : [];

  return (
    <Sheet open onClose={onClose} title={lead?.nombre ?? "Lead"}>
      {!lead ? (
        <div className="p-5 text-sm text-neutral-500">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <LeadHeader nombre={lead.nombre} status={lead.status} origenApp={lead.origenApp} />

          <LeadContactCard whatsapp={lead.whatsapp} fecha={lead.fecha} agente={lead.agente} />

          <ConsentStatus accepted={lead.consentimiento} fecha={lead.consentimientoFecha} />

          <Link
            href={`/mini-apps/${lead.miniAppId}/leads/${lead.id}/resumen`}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-primary-600 px-4 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.01] hover:brightness-110"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Ver resumen visual
          </Link>

          {models.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Datos de la simulación</p>
              <div className="grid grid-cols-2 gap-3">
                {models.map((m) => (
                  <SimulationMetricCard key={m.key} model={m} />
                ))}
              </div>
            </div>
          )}

          <div className="my-1 h-px bg-border-default" />

          <div className="flex flex-col gap-2">
            <LeadActionButton
              variant={lead.contactId ? "confirmed" : "secondary"}
              onClick={handleConvert}
              loading={isPending}
              disabled={!!lead.contactId}
            >
              {lead.contactId ? "Ya es Contacto" : "Convertir a Contacto"}
            </LeadActionButton>
            <LeadActionButton
              variant={lead.opportunityId ? "confirmed" : "secondary"}
              icon={<ArrowLeftRight className="size-4" aria-hidden="true" />}
              onClick={handleMoveToPipeline}
              loading={isPending}
              disabled={!!lead.opportunityId}
            >
              {lead.opportunityId ? "Ya está en el Pipeline" : "Mover a Pipeline"}
            </LeadActionButton>

            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Asignar asesor</p>
              <select
                value=""
                onChange={(e) => e.target.value && handleAssign(e.target.value)}
                disabled={!lead.opportunityId || isPending}
                className="w-full rounded-xl border border-border-default bg-surface-1 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent-500 disabled:opacity-40"
              >
                <option value="">{lead.opportunityId ? "Elegir asesor…" : "Primero mové el lead al Pipeline"}</option>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            <LeadActionButton variant="primary" icon={<MessageCircle className="size-4" aria-hidden="true" />} onClick={handleStartConversation} loading={isPending}>
              Iniciar conversación
            </LeadActionButton>

            <Link href="/inbox" className="text-center text-xs text-accent-600 hover:text-accent-700 hover:underline">
              Ver en el Inbox →
            </Link>
          </div>
        </div>
      )}
    </Sheet>
  );
}
