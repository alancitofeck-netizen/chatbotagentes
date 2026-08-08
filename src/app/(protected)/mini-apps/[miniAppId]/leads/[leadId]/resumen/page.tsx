import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getMiniAppLeadDetail, getMiniAppDetail } from "@/lib/miniApps/queries";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { ResponseSummaryScreen } from "@/components/responseSummary/ResponseSummaryScreen";

export const metadata: Metadata = { title: "Resumen de lead — Growth Link" };

const STATUS_LABEL: Record<string, string> = { new: "Nuevo", contacted: "Contactado", converted: "Convertido", discarded: "Descartado" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function MiniAppLeadResumenPage({ params }: { params: Promise<{ miniAppId: string; leadId: string }> }) {
  const { miniAppId, leadId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "mini_apps");

  const [lead, miniApp] = await Promise.all([getMiniAppLeadDetail(workspaceId, leadId), getMiniAppDetail(workspaceId, miniAppId)]);
  if (!lead) notFound();

  const models = normalizeMiniAppLeadResponses(lead, miniApp);

  return (
    <ResponseSummaryScreen
      backHref={`/mini-apps/${miniAppId}`}
      backLabel="Volver a la mini app"
      title="Resumen del lead"
      subtitle={miniApp ? `Respuestas capturadas en "${miniApp.name}".` : "Respuestas capturadas."}
      meta={[
        { label: "Cliente", value: lead.nombre },
        { label: "WhatsApp", value: lead.whatsapp },
        { label: "Fecha", value: formatDateTime(lead.fecha) },
        { label: "Estado", value: STATUS_LABEL[lead.status] ?? lead.status },
      ]}
      models={models}
    />
  );
}
