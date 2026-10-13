import { NextResponse } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMiniAppDetail, getMiniAppLeadDetail } from "@/lib/miniApps/queries";
import { normalizeMiniAppLeadResponses } from "@/components/responseSummary/normalizeMiniAppLeadResponses";
import { getResultFieldSpec, getLeadResultValue, formatResultValue, type ResultFieldFormat } from "@/lib/miniApps/resultField";
import { buildLeadPdf } from "@/lib/miniApps/leadPdf";
import { LEAD_STATUS_LABEL } from "@/app/(protected)/mini-apps/[miniAppId]/leadStatus";

/** Montos como en la lista de respuestas ("$11"), más la moneda para que no haya dudas. */
function formatResult(value: number, format: ResultFieldFormat): string {
  if (format !== "currency") return formatResultValue(value, format);
  return `${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value)} MXN`;
}

// pdfkit necesita APIs de Node (Buffer/streams).
export const runtime = "nodejs";

/** Descarga la ficha de un lead de Mini App en PDF (botón "PDF" del panel de vista rápida). Mismo patrón de
 * autenticación sin redirect que /api/mini-apps/[miniAppId]/leads/export; los datos se leen con la sesión del
 * usuario, así que RLS limita todo a su workspace. */
export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const lead = await getMiniAppLeadDetail(active.workspaceId, leadId);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  const [miniApp, { data: notes }] = await Promise.all([
    getMiniAppDetail(active.workspaceId, lead.miniAppId),
    supabase
      .from("notes")
      .select("body, created_at")
      .eq("workspace_id", active.workspaceId)
      .eq("notable_type", "mini_app_lead")
      .eq("notable_id", leadId)
      .order("created_at", { ascending: false }),
  ]);

  const spec = miniApp ? getResultFieldSpec(miniApp.templateKey) : null;
  const resultValue = miniApp && spec ? getLeadResultValue(miniApp.templateKey, lead.data) : null;

  const pdf = await buildLeadPdf({
    lead,
    miniApp,
    statusLabel: LEAD_STATUS_LABEL[lead.status] ?? lead.status,
    // El resultado va destacado arriba: no se repite en la lista.
    responses: normalizeMiniAppLeadResponses(lead, miniApp).filter((r) => r.section !== "Resultado" && r.key !== spec?.key),
    result: spec && resultValue !== null ? { label: spec.label, value: formatResult(resultValue, spec.format) } : null,
    notes: (notes ?? []).map((n) => ({ body: n.body as string, createdAt: n.created_at as string })),
  });

  const slug = lead.nombre
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40) || "lead";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lead-${slug}-${lead.fecha.slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
