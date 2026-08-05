"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Mail, MessageCircle, ShieldPlus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { AdvisorySessionDetail } from "@/lib/advisorySessions/queries";
import { ADVISORY_BRANCHES } from "@/lib/advisorySessions/constants";
import { finalizeAdvisorySessionAction } from "@/lib/advisorySessions/actions";

function fieldRows(data: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([key, value]) => ({ key, value: String(value) }));
}

export function SummaryStep({ session, onFinalized }: { session: AdvisorySessionDetail; onFinalized: () => void }) {
  const router = useRouter();
  const [finalizing, startFinalizing] = useTransition();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const branch = session.branchKey ? ADVISORY_BRANCHES.find((b) => b.key === session.branchKey) : null;
  const clientLabel = session.contactName ?? "el cliente";

  function handleFinalize() {
    startFinalizing(async () => {
      try {
        await finalizeAdvisorySessionAction(session.id);
        toast.success("Asesoría finalizada — se creó una nota y una tarea de seguimiento.");
        onFinalized();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo finalizar la asesoría.");
      }
    });
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    try {
      window.open(`/api/asesoria-guiada/${session.id}/export`, "_blank");
    } finally {
      setGeneratingPdf(false);
    }
  }

  function buildMessageText() {
    const summary = (session.aiAnalysis as { summary?: string } | null)?.summary;
    return `Hola ${clientLabel}, gracias por tu tiempo hoy.${branch ? ` Charlamos sobre ${branch.label.toLowerCase()}.` : ""}${
      summary ? ` ${summary}` : ""
    } Te escribo para coordinar los siguientes pasos.`;
  }

  function handleWhatsApp() {
    if (!session.contactPhone) {
      toast.error("Este cliente no tiene teléfono cargado.");
      return;
    }
    const digits = session.contactPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(buildMessageText())}`, "_blank", "noopener,noreferrer");
  }

  function handleEmail() {
    if (!session.contactEmail) {
      toast.error("Este cliente no tiene email cargado.");
      return;
    }
    window.open(`mailto:${session.contactEmail}?subject=${encodeURIComponent("Seguimiento de nuestra reunión")}&body=${encodeURIComponent(buildMessageText())}`);
  }

  function handleCreatePolicy() {
    const params = new URLSearchParams();
    if (session.contactId) params.set("createContact", session.contactId);
    if (session.contactName) params.set("createName", session.contactName);
    if (session.contactPhone) params.set("createPhone", session.contactPhone);
    if (session.contactEmail) params.set("createEmail", session.contactEmail);
    router.push(`/polizas?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Resumen</h2>
        <p className="text-sm text-neutral-500">Toda la información recopilada durante la reunión.</p>
      </div>

      {session.status === "completada" && (
        <div className="flex items-center gap-2 rounded-md bg-success-bg p-3 text-sm text-success-strong">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          Esta asesoría ya fue finalizada.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Datos personales</h3>
          {fieldRows(session.profileData).length === 0 ? (
            <p className="text-sm text-neutral-500">Sin datos cargados.</p>
          ) : (
            <dl className="flex flex-col gap-1.5 text-sm">
              {fieldRows(session.profileData).map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">{r.key}</dt>
                  <dd className="truncate text-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Necesidades</h3>
          {fieldRows(session.discoveryData).length === 0 ? (
            <p className="text-sm text-neutral-500">Sin datos cargados.</p>
          ) : (
            <dl className="flex flex-col gap-1.5 text-sm">
              {fieldRows(session.discoveryData).map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-neutral-500">{r.key}</dt>
                  <dd className="truncate text-right text-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
          <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Coberturas {branch && <Badge variant="accent">{branch.label}</Badge>}
          </h3>
          {fieldRows(session.branchAnswers).length === 0 ? (
            <p className="text-sm text-neutral-500">Sin ramo seleccionado o sin respuestas.</p>
          ) : (
            <dl className="flex flex-col gap-1.5 text-sm">
              {fieldRows(session.branchAnswers).map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">{r.key}</dt>
                  <dd className="truncate text-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Análisis IA</h3>
          {!session.aiAnalysis ? (
            <p className="text-sm text-neutral-500">Todavía no se generó el análisis.</p>
          ) : (
            <p className="text-sm text-foreground">{(session.aiAnalysis as { summary?: string }).summary}</p>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Acciones</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleCreatePolicy}>
            <ShieldPlus className="size-4" aria-hidden="true" />
            Crear póliza / cotización
          </Button>
          <Button variant="secondary" onClick={handleGeneratePdf} loading={generatingPdf}>
            <FileDown className="size-4" aria-hidden="true" />
            Generar PDF
          </Button>
          <Button variant="secondary" onClick={handleWhatsApp}>
            <MessageCircle className="size-4" aria-hidden="true" />
            Enviar por WhatsApp
          </Button>
          <Button variant="secondary" onClick={handleEmail}>
            <Mail className="size-4" aria-hidden="true" />
            Enviar por Email
          </Button>
        </div>
        {session.status !== "completada" && (
          <Button onClick={handleFinalize} loading={finalizing} className="mt-2 self-start">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Finalizar asesoría
          </Button>
        )}
      </div>
    </div>
  );
}
