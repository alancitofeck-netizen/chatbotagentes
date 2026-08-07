import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { getPolicyList } from "@/lib/policies/queries";
import { POLICY_STAGES } from "@/lib/policies/constants";
import { toCsv, toXlsx, toPdf, type ExportColumn } from "@/lib/documents/exports";
import { logExportJob } from "@/lib/dataTransfer/queries";

// pdfkit/exceljs need Node APIs (Buffer/streams) not available on edge.
export const runtime = "nodejs";

const FORMATS = ["csv", "xlsx", "pdf"] as const;
const STAGE_NAME_BY_KEY = new Map(POLICY_STAGES.map((s) => [s.key, s.name]));

type PolicyRow = Awaited<ReturnType<typeof getPolicyList>>[number];

const COLUMNS: ExportColumn<PolicyRow>[] = [
  { header: "Número", accessor: (r) => r.policyNumber ?? "" },
  { header: "Cliente", accessor: (r) => r.contactName },
  { header: "Aseguradora", accessor: (r) => r.company },
  { header: "Ramo", accessor: (r) => r.insuranceType },
  { header: "Producto", accessor: (r) => r.product ?? "" },
  { header: "Prima", accessor: (r) => r.premium ?? "" },
  { header: "Moneda", accessor: (r) => r.premiumCurrency },
  { header: "Frecuencia", accessor: (r) => r.paymentFrequency ?? "" },
  { header: "Inicio", accessor: (r) => r.startDate ?? "" },
  { header: "Vencimiento", accessor: (r) => r.endDate ?? "" },
  { header: "Estado", accessor: (r) => STAGE_NAME_BY_KEY.get(r.status) ?? r.status },
  { header: "Ejecutivo", accessor: (r) => r.ownerName ?? "" },
];

/** Mismo patrón redirect-free que /api/documents/export (Route Handler, no
 * Server Action, para poder devolver un Content-Disposition real). */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") as (typeof FORMATS)[number] | null;
  if (!format || !FORMATS.includes(format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });

  const rows = await getPolicyList(active.workspaceId);
  const filenameBase = `polizas-${new Date().toISOString().slice(0, 10)}`;
  const memberId = await getCurrentMemberId(active.workspaceId);
  void logExportJob(active.workspaceId, memberId, "policies", format, `${filenameBase}.${format}`, rows.length);

  if (format === "csv") {
    return new NextResponse(toCsv(rows as unknown[], COLUMNS as ExportColumn<never>[]), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await toXlsx(rows as unknown[], COLUMNS as ExportColumn<never>[], "Pólizas");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await toPdf(rows as unknown[], COLUMNS as ExportColumn<never>[], "Pólizas");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
