import "server-only";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getContactList, getCompanyGroups } from "@/lib/contacts/queries";
import { getConversationList } from "@/lib/inbox/queries";
import { getTasks } from "@/lib/tasks/queries";
import { getCalendarEvents } from "@/lib/calendar/queries";
import { getAgentList } from "@/lib/agents/queries";
import { getDashboardKpis, getLeadsBySource, getTopOpportunities } from "@/lib/dashboard/queries";
import { ENTITY_LABELS, type ExportEntity, type ExportFormat } from "@/lib/documents/exportConstants";

export { ENTITY_LABELS, type ExportEntity, type ExportFormat };

interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/** Flat KPI summary — there is no "Reportes" module in this app yet, so this
 * reuses the exact queries the Dashboard already renders
 * (getDashboardKpis/getLeadsBySource/getTopOpportunities) instead of building
 * a parallel reporting data source. */
async function buildReportsSummary(workspaceId: string) {
  const [kpis, sources, top] = await Promise.all([
    getDashboardKpis(workspaceId),
    getLeadsBySource(workspaceId),
    getTopOpportunities(workspaceId, 10),
  ]);
  const rows: { section: string; metric: string; value: string }[] = [
    { section: "KPIs", metric: "Leads hoy", value: String(kpis.leadsToday) },
    { section: "KPIs", metric: "Leads ayer", value: String(kpis.leadsYesterday) },
    { section: "KPIs", metric: "Conversaciones activas", value: String(kpis.conversationsActive) },
    { section: "KPIs", metric: "Conversaciones sin leer", value: String(kpis.conversationsUnread) },
    { section: "KPIs", metric: "Conversaciones en espera", value: String(kpis.conversationsWaiting) },
    { section: "KPIs", metric: "Reuniones hoy", value: String(kpis.meetingsToday) },
    { section: "KPIs", metric: "Ventas este mes", value: String(kpis.salesThisMonth) },
    { section: "KPIs", metric: "Tasa de conversión", value: `${kpis.conversionRate}%` },
    ...sources.map((s) => ({ section: "Leads por fuente", metric: s.source, value: String(s.count) })),
    ...top.map((o) => ({ section: "Top oportunidades", metric: o.title, value: `${o.value} ${o.currency}` })),
  ];
  return rows;
}

/** One entry point per exportable entity, reusing each module's existing
 * list query instead of duplicating data-fetching logic. `calendar` pulls a
 * wide ±1 year window since there's no natural "all events" query. */
export async function getExportRows(entity: ExportEntity, workspaceId: string): Promise<{ rows: unknown[]; columns: ExportColumn<never>[] }> {
  switch (entity) {
    case "contacts": {
      const rows = await getContactList(workspaceId, {});
      const columns: ExportColumn<Awaited<ReturnType<typeof getContactList>>[number]>[] = [
        { header: "Nombre", accessor: (r) => r.name },
        { header: "Teléfono", accessor: (r) => r.phone ?? "" },
        { header: "Email", accessor: (r) => r.email ?? "" },
        { header: "Empresa", accessor: (r) => r.company ?? "" },
        { header: "Estado WhatsApp", accessor: (r) => r.whatsappOptStatus },
        { header: "Creado", accessor: (r) => r.createdAt },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "companies": {
      const rows = await getCompanyGroups(workspaceId);
      const columns: ExportColumn<Awaited<ReturnType<typeof getCompanyGroups>>[number]>[] = [
        { header: "Empresa", accessor: (r) => r.company },
        { header: "Contactos", accessor: (r) => r.contactCount },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "conversations": {
      const rows = await getConversationList(workspaceId, {});
      const columns: ExportColumn<Awaited<ReturnType<typeof getConversationList>>[number]>[] = [
        { header: "Contacto", accessor: (r) => r.contactName },
        { header: "Teléfono", accessor: (r) => r.contactPhone ?? "" },
        { header: "Empresa", accessor: (r) => r.company ?? "" },
        { header: "Estado", accessor: (r) => r.status },
        { header: "Último mensaje", accessor: (r) => r.lastMessagePreview },
        { header: "Fecha", accessor: (r) => r.lastMessageAt ?? "" },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "tasks": {
      const rows = await getTasks(workspaceId, {});
      const columns: ExportColumn<Awaited<ReturnType<typeof getTasks>>[number]>[] = [
        { header: "Título", accessor: (r) => r.title },
        { header: "Prioridad", accessor: (r) => r.priority },
        { header: "Estado", accessor: (r) => r.status },
        { header: "Vencimiento", accessor: (r) => r.dueAt ?? "" },
        { header: "Asignado a", accessor: (r) => r.assignedTo?.fullName ?? "" },
        { header: "Creada", accessor: (r) => r.createdAt },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "calendar": {
      const now = new Date();
      const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
      const rangeEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
      const rows = await getCalendarEvents(workspaceId, rangeStart, rangeEnd);
      const columns: ExportColumn<Awaited<ReturnType<typeof getCalendarEvents>>[number]>[] = [
        { header: "Título", accessor: (r) => r.title },
        { header: "Tipo", accessor: (r) => r.eventType },
        { header: "Inicio", accessor: (r) => r.startTime },
        { header: "Fin", accessor: (r) => r.endTime },
        { header: "Contacto", accessor: (r) => r.contactName ?? "" },
        { header: "Responsable", accessor: (r) => r.assignedTo?.fullName ?? "" },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "agents": {
      const rows = await getAgentList(workspaceId);
      const columns: ExportColumn<Awaited<ReturnType<typeof getAgentList>>[number]>[] = [
        { header: "Nombre", accessor: (r) => r.fullName },
        { header: "Email", accessor: (r) => r.email },
        { header: "Rol", accessor: (r) => r.role },
        { header: "Cargo", accessor: (r) => r.title ?? "" },
        { header: "Estado", accessor: (r) => r.status },
        { header: "Leads asignados", accessor: (r) => r.leadsAssigned },
        { header: "Reuniones agendadas", accessor: (r) => r.meetingsScheduled },
        { header: "Tasa de conversión", accessor: (r) => `${r.conversionRate}%` },
        { header: "Score", accessor: (r) => r.score },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
    case "reports": {
      const rows = await buildReportsSummary(workspaceId);
      const columns: ExportColumn<Awaited<ReturnType<typeof buildReportsSummary>>[number]>[] = [
        { header: "Sección", accessor: (r) => r.section },
        { header: "Métrica", accessor: (r) => r.metric },
        { header: "Valor", accessor: (r) => r.value },
      ];
      return { rows, columns: columns as ExportColumn<never>[] };
    }
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: unknown[], columns: ExportColumn<never>[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => csvEscape(String(c.accessor(row as never) ?? ""))).join(","));
  return [header, ...lines].join("\n");
}

export async function toXlsx(rows: unknown[], columns: ExportColumn<never>[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: 24 }));
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.header, c.accessor(row as never)])));
  }
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function toPdf(rows: unknown[], columns: ExportColumn<never>[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text(title);
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const startX = doc.page.margins.left;
    let y = doc.y;

    function drawHeader() {
      doc.fontSize(9).font("Helvetica-Bold");
      columns.forEach((c, i) => doc.text(c.header, startX + i * colWidth, y, { width: colWidth - 6 }));
      y += 16;
      doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).stroke();
      doc.font("Helvetica");
    }
    drawHeader();

    for (const row of rows) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      columns.forEach((c, i) => {
        const value = String(c.accessor(row as never) ?? "");
        doc.fontSize(8).text(value.slice(0, 80), startX + i * colWidth, y, { width: colWidth - 6 });
      });
      y += 14;
    }

    doc.end();
  });
}
