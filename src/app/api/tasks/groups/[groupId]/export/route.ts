import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser } from "@/lib/auth/session";
import { getTasksByGroup, type TaskItem } from "@/lib/tasks/queries";
import { toCsv, toXlsx, toPdf, type ExportColumn } from "@/lib/documents/exports";
import { PRIORITY_META, STATUS_META } from "@/components/tasks/priorityMeta";

// pdfkit/exceljs need Node APIs (Buffer/streams) not available on edge.
export const runtime = "nodejs";

const FORMATS = ["csv", "xlsx", "pdf"] as const;

const COLUMNS: ExportColumn<TaskItem>[] = [
  { header: "Título", accessor: (t) => t.title },
  { header: "Estado", accessor: (t) => STATUS_META[t.status].label },
  { header: "Prioridad", accessor: (t) => PRIORITY_META[t.priority].label },
  { header: "Vencimiento", accessor: (t) => (t.dueAt ? new Date(t.dueAt).toLocaleDateString("es") : "") },
  { header: "Responsable", accessor: (t) => t.assignedTo?.fullName ?? "" },
  { header: "Etiquetas", accessor: (t) => t.tags.map((tag) => tag.name).join(", ") },
];

/** Same pattern as the Mini Apps leads export route (src/app/api/mini-apps/
 * [miniAppId]/leads/export/route.ts) — reuses the pure formatters from
 * src/lib/documents/exports.ts directly rather than forcing this into the
 * Documents page's whole-workspace entity selector. requireActiveWorkspace()
 * isn't used here since it would wrongly try to redirect() from a Route
 * Handler. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const format = request.nextUrl.searchParams.get("format") as (typeof FORMATS)[number] | null;
  if (!format || !FORMATS.includes(format)) return NextResponse.json({ error: "invalid_format" }, { status: 400 });

  const tasks = await getTasksByGroup(active.workspaceId, groupId);
  const filenameBase = `grupo-tareas-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(tasks as unknown[], COLUMNS as ExportColumn<never>[]), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await toXlsx(tasks as unknown[], COLUMNS as ExportColumn<never>[], "Tareas");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const buffer = await toPdf(tasks as unknown[], COLUMNS as ExportColumn<never>[], "Tareas del grupo");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
