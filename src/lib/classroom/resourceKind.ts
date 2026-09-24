import { FileText, Image as ImageIcon, Link as LinkIcon, File as FileIcon, type LucideIcon } from "lucide-react";
import { fileTypeMetaFor } from "@/components/documents/documentIcons";

/** No hay columna "kind" en classroom_lesson_resources (0071_classroom_module.sql,
 * extendida en 0184) — se deriva del MIME real guardado por el upload
 * (`file_type`, ver src/app/api/classroom/resources/route.ts) o, para un
 * recurso sin archivo (un enlace pegado a mano, no subido), del valor
 * literal `"link"` que le pone addLessonResource cuando no pasa por el
 * Route Handler de subida. Reusa fileTypeMetaFor (ya usado en la tab
 * Archivos del CRM) para no duplicar la tabla de extensiones. */
export type ResourceKind = "pdf" | "image" | "link" | "file";

export function resourceKind(fileType: string | null, label: string): ResourceKind {
  if (fileType === "link") return "link";
  if (fileType === "application/pdf") return "pdf";
  if (fileType?.startsWith("image/")) return "image";
  const meta = fileTypeMetaFor(label);
  if (meta.label === "PDF") return "pdf";
  if (meta.label === "Imagen") return "image";
  return "file";
}

export const RESOURCE_KIND_ICON: Record<ResourceKind, LucideIcon> = {
  pdf: FileText,
  image: ImageIcon,
  link: LinkIcon,
  file: FileIcon,
};

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  image: "Imagen",
  link: "Enlace",
  file: "Archivo",
};
