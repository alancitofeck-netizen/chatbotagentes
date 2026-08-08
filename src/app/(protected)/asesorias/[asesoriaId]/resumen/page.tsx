import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { createClient } from "@/lib/supabase/server";
import { getAsesoriaById, getAsesoriaResponses, type AsesoriaStatus } from "@/lib/asesorias/queries";
import { normalizeAsesoriaResponses } from "@/components/responseSummary/normalizeAsesoriaResponses";
import { ResponseSummaryScreen } from "@/components/responseSummary/ResponseSummaryScreen";

export const metadata: Metadata = { title: "Resumen de Asesoría — Growth Link" };

const STATUS_LABEL: Record<AsesoriaStatus, string | undefined> = { no_iniciada: undefined, en_progreso: undefined, finalizada: "Finalizada con éxito" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AsesoriaResumenPage({ params }: { params: Promise<{ asesoriaId: string }> }) {
  const { asesoriaId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesorias");

  const [asesoria, responses] = await Promise.all([getAsesoriaById(workspaceId, asesoriaId), getAsesoriaResponses(workspaceId, asesoriaId)]);
  if (!asesoria) notFound();

  let contactName: string | null = null;
  let advisorName: string | null = null;
  {
    const supabase = await createClient();
    if (asesoria.contactId) {
      const { data } = await supabase.from("contacts").select("name").eq("id", asesoria.contactId).maybeSingle();
      contactName = (data?.name as string | undefined) ?? null;
    }
    if (asesoria.advisorId) {
      const { data } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
      advisorName = ((data ?? []) as { member_id: string; full_name: string }[]).find((m) => m.member_id === asesoria.advisorId)?.full_name ?? null;
    }
  }

  const models = normalizeAsesoriaResponses(responses);

  return (
    <ResponseSummaryScreen
      backHref={`/asesorias/${asesoriaId}`}
      backLabel="Volver a la asesoría"
      title="Resumen de la asesoría"
      subtitle="Un informe completo de la conversación y los acuerdos."
      statusLabel={STATUS_LABEL[asesoria.status]}
      meta={[
        { label: "Cliente", value: contactName ?? "Sin contacto" },
        { label: "Fecha", value: formatDateTime(asesoria.startedAt) },
        { label: "Asesor", value: advisorName ?? "Sin asignar" },
        { label: "Estado", value: asesoria.status === "finalizada" ? "Finalizada" : asesoria.status === "en_progreso" ? "En progreso" : "No iniciada" },
      ]}
      models={models}
    />
  );
}
