import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getExportRows, toCsv, toXlsx, toPdf, ENTITY_LABELS, type ExportEntity, type ExportFormat } from "@/lib/documents/exports";

// pdfkit/exceljs need Node APIs (Buffer/streams) not available on edge.
export const runtime = "nodejs";

const ENTITIES = Object.keys(ENTITY_LABELS) as ExportEntity[];
const FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];

/**
 * Route Handler (not a Server Action) so the response can carry a real
 * `Content-Disposition: attachment` file download — same redirect-free auth
 * pattern as src/app/api/messages/send/route.ts, since requireActiveWorkspace()
 * would wrongly try to redirect() here.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const entity = request.nextUrl.searchParams.get("entity") as ExportEntity | null;
  const format = request.nextUrl.searchParams.get("format") as ExportFormat | null;
  if (!entity || !ENTITIES.includes(entity)) return NextResponse.json({ error: "invalid_entity" }, { status: 400 });
  if (!format || !FORMATS.includes(format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });

  const { rows, columns } = await getExportRows(entity, active.workspaceId);
  const label = ENTITY_LABELS[entity];
  const filenameBase = `${entity}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(rows, columns), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await toXlsx(rows, columns, label);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await toPdf(rows, columns, label);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
