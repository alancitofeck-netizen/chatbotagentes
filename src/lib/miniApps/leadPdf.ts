import "server-only";
import PDFDocument from "pdfkit";
import type { MiniAppDetail, MiniAppLeadDetail } from "@/lib/miniApps/queries";
import type { ResponseViewModel } from "@/components/responseSummary/types";

/** Ficha de un lead de Mini App en PDF, con el mismo orden y estilo que el panel de vista rápida
 * (LeadQuickView.tsx): nombre y origen, etapa, el resultado destacado, contacto, todo lo que respondió y
 * las notas. Mismo mecanismo PDFDocument→chunks→Buffer que presentations/pdf.ts. */

const NAVY = "#0F1B3D";
const ACCENT = "#0E8FA0";
const SUCCESS = "#1F7A4D";
const SUCCESS_BG = "#E7F3EC";
const TEXT = "#111827";
const MUTED = "#6B7280";
const SUBTLE = "#9CA3AF";
const LINE = "#E5E7EB";
const CHIP_BG = "#E6F4F6";

const MARGIN = 48;
const FOOTER_SPACE = 56;

export interface LeadPdfInput {
  lead: MiniAppLeadDetail;
  miniApp: MiniAppDetail | null;
  statusLabel: string;
  responses: ResponseViewModel[];
  result: { label: string; value: string } | null;
  notes: { body: string; createdAt: string }[];
}

/** Las fuentes estándar de PDF (Helvetica) solo cubren Latin-1 y unos pocos signos: sin esto, un emoji
 * en el nombre o una nota sale como basura. Los espacios finos de Intl pasan a espacio normal. */
function pdfText(value: string): string {
  return value
    .replace(/[   ]/g, " ")
    .replace(/[^\u0009\u000A\u000D -ÿ–—‘’“”•…€]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatDate(iso: string, withTime: boolean): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function initials(name: string): string {
  return pdfText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function buildLeadPdf({ lead, miniApp, statusLabel, responses, result, notes }: LeadPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true, info: { Title: `Lead — ${pdfText(lead.nombre)}`, Author: "Growth Link" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - MARGIN * 2;
    const bottom = () => doc.page.height - FOOTER_SPACE;
    let y = 0;

    function ensureSpace(height: number) {
      if (y + height <= bottom()) return;
      doc.addPage();
      y = MARGIN;
    }

    // ---- Encabezado ----
    doc.rect(0, 0, doc.page.width, 64).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#FFFFFF").text("Growth Link", MARGIN, 24, { lineBreak: false });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#C7D2FE")
      .text("Ficha del lead", MARGIN, 28, { width, align: "right", lineBreak: false });
    y = 92;

    // ---- Nombre y origen ----
    const name = pdfText(lead.nombre) || "Sin nombre";
    doc.circle(MARGIN + 22, y + 22, 22).fill(ACCENT);
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#FFFFFF")
      .text(initials(lead.nombre) || "?", MARGIN, y + 15, { width: 44, align: "center", lineBreak: false });
    const textX = MARGIN + 58;
    doc.font("Helvetica-Bold").fontSize(20).fillColor(TEXT).text(name, textX, y + 2, { width: width - 58 });
    const origin = pdfText(lead.origenApp || miniApp?.name || "");
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(MUTED)
      .text(`Llegó el ${formatDate(lead.fecha, true)}${origin ? ` desde ${origin}` : ""}`, textX, doc.y + 2, { width: width - 58 });
    y = Math.max(y + 52, doc.y + 14);

    // ---- Etapa ----
    const stageText = `Etapa: ${pdfText(statusLabel)}`;
    doc.font("Helvetica-Bold").fontSize(10);
    const chipWidth = doc.widthOfString(stageText) + 22;
    doc.roundedRect(MARGIN, y, chipWidth, 22, 11).fill(CHIP_BG);
    doc.fillColor(ACCENT).text(stageText, MARGIN + 11, y + 6.5, { lineBreak: false });
    y += 36;

    // ---- Resultado destacado ----
    if (result) {
      doc.roundedRect(MARGIN, y, width, 64, 12).fill(SUCCESS_BG);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(SUCCESS).text(pdfText(result.label), MARGIN + 16, y + 13, { width: width - 32 });
      doc.font("Helvetica-Bold").fontSize(24).fillColor(SUCCESS).text(pdfText(result.value), MARGIN + 16, y + 28, { width: width - 32 });
      y += 82;
    }

    // ---- Secciones ----
    function sectionTitle(title: string) {
      ensureSpace(40);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(SUBTLE).text(title.toUpperCase(), MARGIN, y, { characterSpacing: 0.6 });
      y = doc.y + 6;
    }

    function row(label: string, value: string) {
      const labelWidth = width * 0.44;
      const valueWidth = width - labelWidth - 12;
      const cleanLabel = pdfText(label);
      const cleanValue = pdfText(value) || "—";
      doc.font("Helvetica").fontSize(10.5);
      const height = Math.max(doc.heightOfString(cleanLabel, { width: labelWidth }), doc.heightOfString(cleanValue, { width: valueWidth })) + 11;
      ensureSpace(height);
      doc.fillColor(MUTED).text(cleanLabel, MARGIN, y + 5.5, { width: labelWidth });
      doc.fillColor(TEXT).text(cleanValue, MARGIN + labelWidth + 12, y + 5.5, { width: valueWidth, align: "right" });
      y += height;
      doc.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.6).strokeColor(LINE).stroke();
    }

    sectionTitle("Contacto");
    row("WhatsApp", lead.whatsapp || "—");
    const email = typeof lead.data.email === "string" ? lead.data.email : "";
    if (email) row("Email", email);
    if (typeof lead.data.edad === "number") row("Edad", `${lead.data.edad} años`);
    if (lead.agente) row("Agente", lead.agente);
    y += 14;

    const answers = responses.filter((r) => r.key !== "email" && r.key !== "edad");
    if (answers.length > 0) {
      sectionTitle("Lo que respondió");
      for (const r of answers) row(r.question, Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer));
      y += 14;
    }

    sectionTitle("Notas");
    if (notes.length === 0) {
      doc.font("Helvetica").fontSize(10.5).fillColor(SUBTLE).text("Sin notas.", MARGIN, y + 4, { width });
      y = doc.y + 8;
    } else {
      for (const note of notes) {
        const body = pdfText(note.body);
        doc.font("Helvetica").fontSize(10.5);
        const height = doc.heightOfString(body, { width: width - 24 }) + 36;
        ensureSpace(height);
        doc.roundedRect(MARGIN, y, width, height - 8, 8).fill("#F3F4F6");
        doc.font("Helvetica").fontSize(8.5).fillColor(SUBTLE).text(formatDate(note.createdAt, true), MARGIN + 12, y + 9, { width: width - 24 });
        doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(body, MARGIN + 12, y + 22, { width: width - 24 });
        y += height;
      }
    }

    // ---- Pie en cada página ----
    const generated = `Generado el ${formatDate(new Date().toISOString(), true)} · Growth Link`;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // El pie va dentro del margen inferior: sin esto pdfkit abriría una página nueva al escribirlo.
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 34;
      doc.moveTo(MARGIN, footerY - 10).lineTo(doc.page.width - MARGIN, footerY - 10).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.font("Helvetica").fontSize(8.5).fillColor(SUBTLE).text(pdfText(generated), MARGIN, footerY, { width, lineBreak: false });
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN, footerY, { width, align: "right", lineBreak: false });
    }

    doc.end();
  });
}
