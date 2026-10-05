"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeftRight, MessageCircle, Trash2, ShieldPlus, StickyNote, CalendarPlus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { LeadMessageBox } from "./LeadMessageBox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import type { MiniAppLeadDetail, MiniAppDetail, MiniAppLeadActivityEntry } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getWorkspaceModuleStatusAction } from "@/lib/settings/actions";
import {
  getMiniAppLeadDetailAction,
  getMiniAppDetailAction,
  convertMiniAppLeadToContact,
  moveMiniAppLeadToPipeline,
  convertMiniAppLeadToPolicy,
  assignMiniAppLeadAdvisor,
  startMiniAppLeadConversation,
  markMiniAppLeadScheduled,
  deleteMiniAppLead,
  getMiniAppLeadActivityAction,
  getMiniAppLeadNotesAction,
  addMiniAppLeadNoteAction,
} from "@/lib/miniApps/actions";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { SimulationMetricCard } from "@/components/responseSummary/SimulationMetricCard";
import { PolicyFormSheet } from "@/app/(protected)/polizas/PolicyFormSheet";
import { EventFormSheet } from "@/components/calendar/EventFormSheet";
import type { PickedContact } from "@/app/(protected)/calendar/ContactPicker";
import { LeadHeader } from "./LeadHeader";
import { LeadContactCard } from "./LeadContactCard";
import { ConsentStatus } from "./ConsentStatus";
import { LeadActionButton } from "./LeadActionButton";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function LeadDetailDrawer({
  leadId,
  miniAppName,
  members,
  canManage,
  ownMemberId,
  onClose,
  onChanged,
}: {
  leadId: string;
  miniAppName?: string;
  members: WorkspaceMemberOption[];
  canManage: boolean;
  ownMemberId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<MiniAppLeadDetail | null>(null);
  const [miniApp, setMiniApp] = useState<MiniAppDetail | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [policiesEnabled, setPoliciesEnabled] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [schedulingContact, setSchedulingContact] = useState<PickedContact | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [activity, setActivity] = useState<MiniAppLeadActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [notes, setNotes] = useState<{ id: string; body: string; createdAt: string }[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    getMiniAppLeadDetailAction(leadId).then(setLead);
    getMiniAppLeadActivityAction(leadId).then((rows) => {
      setActivity(rows);
      setActivityLoaded(true);
    });
    getMiniAppLeadNotesAction(leadId).then((rows) => {
      setNotes(rows);
      setNotesLoaded(true);
    });
  }, [leadId]);

  useEffect(() => {
    if (lead?.miniAppId) getMiniAppDetailAction(lead.miniAppId).then(setMiniApp);
  }, [lead?.miniAppId]);

  useEffect(() => {
    getWorkspaceModuleStatusAction().then((rows) => setPoliciesEnabled(rows.some((m) => m.moduleKey === "policies" && m.enabled)));
  }, []);

  function handleAddNote() {
    if (!noteBody.trim()) return;
    startTransition(async () => {
      await addMiniAppLeadNoteAction(leadId, noteBody);
      setNoteBody("");
      const fresh = await getMiniAppLeadNotesAction(leadId);
      setNotes(fresh);
    });
  }

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

  function handleOpenScheduling() {
    if (!lead) return;
    setIsScheduling(true);
    startTransition(async () => {
      try {
        let contactId = lead.contactId;
        if (!contactId) {
          const converted = await convertMiniAppLeadToContact(leadId);
          contactId = converted.contactId;
        }
        setSchedulingContact({ id: contactId, name: lead.nombre });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo preparar la cita.");
      } finally {
        setIsScheduling(false);
      }
    });
  }

  function handleEventSaved() {
    markMiniAppLeadScheduled(leadId)
      .then(refresh)
      .catch(() => {});
    setSchedulingContact(null);
  }

  function handleDelete() {
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await deleteMiniAppLead(leadId);
        toast.success("Lead eliminado.");
        setConfirmingDelete(false);
        onClose();
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar el lead.");
      } finally {
        setIsDeleting(false);
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

          <LeadMessageBox key={`${lead.id}-${miniAppName ?? ""}`} nombre={lead.nombre} whatsapp={lead.whatsapp} appName={miniAppName ?? miniApp?.name ?? null} />

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

            {policiesEnabled && (
              <LeadActionButton
                variant={lead.policyId ? "confirmed" : "secondary"}
                icon={<ShieldPlus className="size-4" aria-hidden="true" />}
                onClick={() => setShowPolicyForm(true)}
                disabled={!!lead.policyId}
              >
                {lead.policyId ? "Ya tiene póliza" : "Convertir en cliente y crear póliza"}
              </LeadActionButton>
            )}

            <LeadActionButton variant="secondary" icon={<CalendarPlus className="size-4" aria-hidden="true" />} onClick={handleOpenScheduling} loading={isScheduling}>
              Agendar cita
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

            {canManage && (
              <>
                <div className="my-1 h-px bg-border-default" />
                <LeadActionButton variant="danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmingDelete(true)}>
                  Eliminar lead
                </LeadActionButton>
              </>
            )}
          </div>

          <div className="my-1 h-px bg-border-default" />

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
              <StickyNote className="size-3" aria-hidden="true" />
              Notas
            </p>
            <div className="flex gap-2">
              <input
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                placeholder="Agregar una nota…"
                className="flex-1 rounded-lg border border-border-default bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={isPending || !noteBody.trim()}
                className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
            {notesLoaded && notes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-lg bg-surface-2 p-3">
                    <p className="text-sm text-foreground">{note.body}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatDateTime(note.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Actividad</p>
            {!activityLoaded ? (
              <p className="text-sm text-neutral-500">Cargando…</p>
            ) : activity.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-0.5 border-l-2 border-border-default pl-3">
                    <p className="text-sm text-foreground">
                      {entry.action}
                      {typeof entry.metadata.stage === "string" ? ` — ${entry.metadata.stage}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {entry.actorName ?? "Sistema"} · {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showPolicyForm && lead && (
        <PolicyFormSheet
          policy={null}
          defaultContact={{ id: lead.contactId ?? undefined, name: lead.nombre, phone: lead.whatsapp }}
          members={members}
          onClose={() => setShowPolicyForm(false)}
          onCreate={(input) => convertMiniAppLeadToPolicy(leadId, input)}
          onSaved={refresh}
        />
      )}

      {schedulingContact && (
        <EventFormSheet
          current={null}
          defaultContact={schedulingContact}
          members={members}
          conversationOptions={[]}
          opportunityOptions={[]}
          canAssignOthers={canManage}
          ownMemberId={ownMemberId}
          onClose={() => setSchedulingContact(null)}
          onSaved={handleEventSaved}
        />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="¿Eliminar este lead?"
        description="Se borra de la bandeja de la mini app y no se puede deshacer. Si ya lo convertiste a Contacto u Oportunidad, esos registros del CRM no se ven afectados."
        confirmLabel="Eliminar lead"
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </Sheet>
  );
}
