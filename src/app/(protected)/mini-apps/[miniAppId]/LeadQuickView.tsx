"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MessageCircle, CalendarPlus, Download } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { MiniAppLeadDetail, MiniAppDetail, MiniAppLeadStatus } from "@/lib/miniApps/queries";
import {
  getMiniAppLeadDetailAction,
  getMiniAppLeadNotesAction,
  addMiniAppLeadNoteAction,
  updateMiniAppLeadStatus,
} from "@/lib/miniApps/actions";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { getResultFieldSpec, getLeadResultValue, formatResultValue } from "@/lib/miniApps/resultField";
import { formatRelativeTime } from "@/lib/utils/format";
import { LEAD_STATUS_LABEL } from "./leadStatus";

/** Panel de vista rápida fijo al costado de la lista de Leads (a pedido
 * explícito: reemplaza el drawer como interacción principal, mismo criterio
 * que el mockup pegado por el usuario) — no duplica las acciones más pesadas
 * (convertir a póliza, actividad completa, notas con historial) que siguen
 * viviendo en LeadDetailDrawer.tsx, detrás de "Ver ficha completa". */
export function LeadQuickView({
  miniApp,
  leadId,
  onOpenFull,
  onChanged,
}: {
  miniApp: MiniAppDetail;
  leadId: string;
  onOpenFull: () => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<MiniAppLeadDetail | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sin reseteo manual de estado acá — el caller (LeadsTab) monta este
  // componente con `key={leadId}`, así que un lead nuevo ya arranca de cero
  // (evita el "setState síncrono dentro de un efecto" que dispara el lint).
  useEffect(() => {
    getMiniAppLeadDetailAction(leadId).then(setLead);
    getMiniAppLeadNotesAction(leadId).then((notes) => setLastNote(notes[0]?.body ?? null));
  }, [leadId]);

  if (!lead) {
    return <div className="rounded-2xl border border-border-default bg-surface-1 p-6 text-sm text-neutral-500">Cargando…</div>;
  }

  const spec = getResultFieldSpec(miniApp.templateKey);
  const resultValue = getLeadResultValue(miniApp.templateKey, lead.data);
  const digits = lead.whatsapp.replace(/\D/g, "");
  const responses = normalizeMiniAppLeadResponses(lead, miniApp).filter((r) => r.section !== "Resultado");
  const email = typeof lead.data.email === "string" ? lead.data.email : null;
  const edad = typeof lead.data.edad === "number" ? lead.data.edad : null;

  function handleStatusChange(status: MiniAppLeadStatus) {
    if (!lead) return;
    updateMiniAppLeadStatus(lead.id, status)
      .then(() => {
        setLead({ ...lead, status });
        onChanged();
      })
      .catch(() => toast.error("No se pudo cambiar la etapa."));
  }

  function handleSaveNote() {
    if (!noteBody.trim()) return;
    startTransition(async () => {
      await addMiniAppLeadNoteAction(leadId, noteBody);
      setLastNote(noteBody);
      setNoteBody("");
      toast.success("Nota guardada.");
    });
  }

  function handleAgendar() {
    // Abre la ficha completa, que ya tiene el flujo real de "Agendar cita"
    // (asegura el contacto, abre el formulario del Calendario) — no se
    // duplica esa lógica acá.
    onOpenFull();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface-1 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={lead.nombre} size={40} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{lead.nombre}</p>
          <p className="truncate text-xs text-neutral-500">
            Llegó {formatRelativeTime(lead.fecha)} desde {lead.origenApp}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {digits.length >= 8 ? (
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success-strong px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            WhatsApp
          </a>
        ) : (
          <span className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-default px-3 py-2.5 text-sm text-neutral-400">Sin WhatsApp</span>
        )}
        <button
          type="button"
          onClick={handleAgendar}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-default px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-2"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Agendar
        </button>
      </div>

      <Select label="Etapa" value={lead.status} onChange={(e) => handleStatusChange(e.target.value as MiniAppLeadStatus)}>
        {(Object.keys(LEAD_STATUS_LABEL) as MiniAppLeadStatus[]).map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABEL[s]}
          </option>
        ))}
      </Select>

      {spec && resultValue !== null && (
        <div className="rounded-xl bg-success-strong/10 p-4">
          <p className="text-xs font-medium text-success-strong">{spec.label}</p>
          <p className="text-2xl font-bold text-success-strong">{formatResultValue(resultValue, spec.format)}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Contacto</p>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">WhatsApp</span>
          <span className="text-foreground">{lead.whatsapp || "—"}</span>
        </div>
        {email && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Email</span>
            <span className="text-foreground">{email}</span>
          </div>
        )}
        {edad !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Edad</span>
            <span className="text-foreground">{edad} años</span>
          </div>
        )}
      </div>

      {responses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Lo que respondió</p>
          {responses.slice(0, 6).map((r) => (
            <div key={r.key} className="flex justify-between gap-3 text-sm">
              <span className="shrink-0 text-neutral-500">{r.question}</span>
              <span className="truncate text-right text-foreground">{Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Nota</label>
        {lastNote && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-foreground">{lastNote}</p>}
        <div className="flex gap-2">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
            placeholder="Ej.: prefiere que lo llamen por la tarde"
            className="flex-1 rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={isPending || !noteBody.trim()}
            className="shrink-0 self-start rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onOpenFull} className="flex-1 rounded-xl bg-gradient-to-r from-accent-500 to-primary-600 px-3 py-2.5 text-sm font-semibold text-white hover:brightness-110">
          Ver ficha completa
        </button>
        <Link
          href={`/mini-apps/${lead.miniAppId}/leads/${lead.id}/resumen`}
          target="_blank"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border-default px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-2"
          title="Ver / imprimir resumen"
        >
          <Download className="size-4" aria-hidden="true" />
          PDF
        </Link>
      </div>
    </div>
  );
}
