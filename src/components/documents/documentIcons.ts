import { FileText, FileSpreadsheet, Presentation, Image as ImageIcon, Archive, File as FileIcon, type LucideIcon } from "lucide-react";

export interface FileTypeMeta {
  icon: LucideIcon;
  color: string;
  label: string;
}

const BY_EXTENSION: Record<string, FileTypeMeta> = {
  pdf: { icon: FileText, color: "text-error-strong", label: "PDF" },
  doc: { icon: FileText, color: "text-primary-600", label: "Word" },
  docx: { icon: FileText, color: "text-primary-600", label: "Word" },
  xls: { icon: FileSpreadsheet, color: "text-success-strong", label: "Excel" },
  xlsx: { icon: FileSpreadsheet, color: "text-success-strong", label: "Excel" },
  csv: { icon: FileSpreadsheet, color: "text-success-strong", label: "CSV" },
  ppt: { icon: Presentation, color: "text-warning-strong", label: "PowerPoint" },
  pptx: { icon: Presentation, color: "text-warning-strong", label: "PowerPoint" },
  txt: { icon: FileText, color: "text-neutral-500", label: "Texto" },
  png: { icon: ImageIcon, color: "text-accent-600", label: "Imagen" },
  jpg: { icon: ImageIcon, color: "text-accent-600", label: "Imagen" },
  jpeg: { icon: ImageIcon, color: "text-accent-600", label: "Imagen" },
  webp: { icon: ImageIcon, color: "text-accent-600", label: "Imagen" },
  zip: { icon: Archive, color: "text-neutral-500", label: "Comprimido" },
};

const DEFAULT_META: FileTypeMeta = { icon: FileIcon, color: "text-neutral-400", label: "Archivo" };

/** Accepted upload types, per the request's explicit list — enforced both in
 * the file picker's `accept` attribute and re-checked on drop (drag&drop
 * bypasses the picker's own filtering). */
export const ACCEPTED_EXTENSIONS = Object.keys(BY_EXTENSION);

export function fileTypeMetaFor(name: string): FileTypeMeta {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? DEFAULT_META;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
