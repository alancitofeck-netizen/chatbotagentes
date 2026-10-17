import type { AdvisorSyncFieldKey } from "@/lib/advisorSync/fieldDictionary";
import type { AgendaRowProblem } from "@/lib/advisorSync/sheetRows";
import type { ValueMap } from "./sheetValueOptions";
import type { EstadoCita } from "./queries";

/** Tipos compartidos entre el panel "Conectar hoja de agendas" (cliente) y sus Server Actions —
 * en un archivo plano, nunca re-exportados desde un "use server" (ver
 * src/lib/notifications/types.ts por el bug de runtime que eso causaba). */

export interface AgendaSheetOptionsInput {
  create_leads: boolean;
  write_back: boolean;
}

export interface AgendaSheetConfigInput {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
  sheetGid: string | null;
  headerRow: number;
  columnMap: Record<string, AdvisorSyncFieldKey>;
  valueMap: ValueMap;
  options: AgendaSheetOptionsInput;
  utcOffsetMinutes: number;
}

export interface AgendaSheetConnectionState extends AgendaSheetConfigInput {
  id: string;
  lastSyncedAt: string | null;
  lastSyncStartedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
}

export interface AgendaSheetStatus {
  /** Cuenta de Google con escritura (la misma de "Exportar referidos a hoja"). */
  account: { connected: boolean; email: string | null };
  connection: AgendaSheetConnectionState | null;
}

export interface AgendaSheetColumn {
  letter: string;
  header: string;
  suggestion: AdvisorSyncFieldKey | null;
  /** Valores distintos que aparecen en esa columna (para el paso de equivalencias). */
  distinctValues: string[];
}

export interface AgendaSheetTabInspection {
  headerRow: number;
  columns: AgendaSheetColumn[];
  /** Primeras filas crudas, para ver dónde están los títulos. */
  preview: string[][];
}

export interface AgendaSheetPreview {
  citas: number;
  nuevosLeads: number;
  leadsExistentes: number;
  sinHora: number;
  problems: { rowNumber: number; name: string; problems: AgendaRowProblem[] }[];
}

export interface AgendaLead {
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  producto: string | null;
  notas: string | null;
  source: string | null;
  createdAt: string | null;
  citas: number;
  lastCitaAt: string | null;
  lastEstado: EstadoCita | null;
  nextCitaAt: string | null;
  contactado: boolean | null;
}
