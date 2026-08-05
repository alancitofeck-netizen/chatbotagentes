import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getAdvisorySessionById } from "@/lib/advisorySessions/queries";
import { toPdf, type ExportColumn } from "@/lib/documents/exports";

// pdfkit needs Node APIs (Buffer/streams) not available on edge.
export const runtime = "nodejs";

interface SummaryRow {
  section: string;
  key: string;
  value: string;
}

/** Mismo patrón redirect-free que /api/policies/export (Route Handler, no
 * Server Action, para poder devolver un Content-Disposition real). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const session = await getAdvisorySessionById(active.workspaceId, sessionId);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows: SummaryRow[] = [];
  function pushEntries(section: string, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;
      rows.push({ section, key, value: String(value) });
    }
  }
  pushEntries("Perfil", session.profileData);
  pushEntries("Descubrimiento", session.discoveryData);
  if (session.branchKey) pushEntries(`Ramo — ${session.branchKey}`, session.branchAnswers);
  const analysis = session.aiAnalysis as { summary?: string; risks?: string[]; recommendedProducts?: string[] } | null;
  if (analysis?.summary) rows.push({ section: "Análisis IA", key: "Resumen", value: analysis.summary });
  if (analysis?.risks?.length) rows.push({ section: "Análisis IA", key: "Riesgos", value: analysis.risks.join("; ") });
  if (analysis?.recommendedProducts?.length) rows.push({ section: "Análisis IA", key: "Productos recomendados", value: analysis.recommendedProducts.join("; ") });
  if (session.summaryNotes) rows.push({ section: "Notas", key: "Comentarios", value: session.summaryNotes });

  const columns: ExportColumn<SummaryRow>[] = [
    { header: "Sección", accessor: (r) => r.section },
    { header: "Campo", accessor: (r) => r.key },
    { header: "Valor", accessor: (r) => r.value },
  ];

  const title = `Asesoría — ${session.contactName ?? "Cliente"}`;
  const buffer = await toPdf(rows as unknown[], columns as ExportColumn<never>[], title);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asesoria-${sessionId}.pdf"`,
    },
  });
}
