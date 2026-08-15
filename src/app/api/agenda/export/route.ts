import { NextResponse, type NextRequest } from "next/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAgendaAppointments } from "@/lib/agenda/queries";
import { ESTADO_CITA_META } from "@/lib/agenda/estadoMeta";
import { toCsv, type ExportColumn } from "@/lib/documents/exports";
import { logExportJob } from "@/lib/dataTransfer/queries";

// Route Handler (no Server Action) para poder devolver un Content-Disposition
// real — mismo patrón que /api/policies/export.
type AppointmentRow = Awaited<ReturnType<typeof getAgendaAppointments>>[number];

const COLUMNS: ExportColumn<AppointmentRow>[] = [
  { header: "Fecha", accessor: (r) => new Date(r.startTime).toLocaleDateString("es-MX") },
  { header: "Hora", accessor: (r) => new Date(r.startTime).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) },
  { header: "Cliente", accessor: (r) => r.contactName ?? "" },
  { header: "Teléfono", accessor: (r) => r.contactPhone ?? "" },
  { header: "Tipo de cita", accessor: (r) => r.appointmentType ?? "" },
  { header: "Asesor", accessor: (r) => r.advisorName },
  { header: "Setter", accessor: (r) => r.setterName ?? "" },
  { header: "Estado", accessor: (r) => ESTADO_CITA_META[r.estadoCita].label },
];

/** Exporta las citas visibles del rango pedido — mismo scope/filtro por rol
 * (agencia agregada / propio workspace de asesor / "mis citas" si sos
 * setter) que ya aplica getAgendaAppointmentsAction, para que el CSV nunca
 * incluya algo que esa cuenta no podría ver en pantalla. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });
  await assertModuleEnabled(active.workspaceId, "agenda");

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "missing_range" }, { status: 400 });

  const memberId = await getCurrentMemberId(active.workspaceId);
  const rows = await getAgendaAppointments(active.workspaceId, { start, end }, { memberId, role: active.role });

  const filenameBase = `agenda-${new Date().toISOString().slice(0, 10)}`;
  void logExportJob(active.workspaceId, memberId, "agenda", "csv", `${filenameBase}.csv`, rows.length);

  return new NextResponse(toCsv(rows as unknown[], COLUMNS as ExportColumn<never>[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
