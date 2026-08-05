import "server-only";
import PDFDocument from "pdfkit";
import type { PresentationDetail } from "@/lib/presentations/queries";

/** Una página por diapositiva (`presentation.slides`) — mismo mecanismo
 * PDFDocument→chunks→Buffer que documents/exports.ts::toPdf, pero con un
 * layout de diapositiva (título grande + cuerpo) en vez de tabla, ya que acá
 * el contenido es una presentación, no un listado de filas. */
export async function buildPresentationPdf(presentation: PresentationDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const primaryColor = presentation.personalInfo.primaryColor ?? "#6366F1";
    const slides = presentation.slides.length ? presentation.slides : [{ key: "portada", title: "Portada", body: presentation.title, order: 0 }];

    slides.forEach((slide, i) => {
      if (i > 0) doc.addPage();

      doc.rect(0, 0, doc.page.width, 8).fill(primaryColor);
      doc.fillColor("#111827");

      doc.fontSize(11).font("Helvetica").fillColor("#6B7280").text(presentation.title, 50, 40);
      doc.moveDown(1.5);

      doc.fontSize(28).font("Helvetica-Bold").fillColor("#111827").text(slide.title, { align: "left" });
      doc.moveDown(1);

      doc.fontSize(13).font("Helvetica").fillColor("#374151").text(slide.body || "—", { align: "left", width: doc.page.width - 100 });

      doc
        .fontSize(9)
        .fillColor("#9CA3AF")
        .text(`${i + 1} / ${slides.length}`, 50, doc.page.height - 40, { width: doc.page.width - 100, align: "right" });
    });

    doc.end();
  });
}
