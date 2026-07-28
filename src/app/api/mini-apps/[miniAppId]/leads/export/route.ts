import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getMiniAppLeads, type MiniAppLeadRow } from "@/lib/miniApps/queries";
import { toCsv, toXlsx, toPdf, type ExportColumn } from "@/lib/documents/exports";

// pdfkit/exceljs need Node APIs (Buffer/streams) not available on edge.
export const runtime = "nodejs";

const FORMATS = ["csv", "xlsx", "pdf"] as const;

const COLUMNS: ExportColumn<MiniAppLeadRow>[] = [
  { header: "Nombre", accessor: (r) => r.nombre },
  { header: "WhatsApp", accessor: (r) => r.whatsapp },
  { header: "Origen", accessor: (r) => r.origenApp },
  { header: "Agente", accessor: (r) => r.agente ?? "" },
  { header: "Fecha", accessor: (r) => r.fecha },
  { header: "Estado", accessor: (r) => r.status },
];

/** Reuses the pure formatter functions from src/lib/documents/exports.ts
 * directly (they don't depend on that module's entity switch) rather than
 * forcing this per-mini-app export into the Documents page's own
 * whole-workspace entity selector, which has no concept of "just this
 * record's leads". Same redirect-free auth pattern as
 * src/app/api/documents/export/route.ts, since requireActiveWorkspace()
 * would wrongly try to redirect() from a Route Handler. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ miniAppId: string }> }) {
  const { miniAppId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") as (typeof FORMATS)[number] | null;
  if (!format || !FORMATS.includes(format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });

  const rows = await getMiniAppLeads(active.workspaceId, miniAppId);
  const filenameBase = `mini-app-leads-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(rows as unknown[], COLUMNS as ExportColumn<never>[]), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await toXlsx(rows as unknown[], COLUMNS as ExportColumn<never>[], "Leads");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await toPdf(rows as unknown[], COLUMNS as ExportColumn<never>[], "Leads");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
