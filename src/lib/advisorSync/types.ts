import type { AdvisorSyncFieldKey } from "./fieldDictionary";

/** Plain shared type, deliberately not declared in queries.ts (server-only)
 * or actions.ts ("use server") — ver src/lib/notifications/types.ts para el
 * bug de producción que esto evita: re-exportar un type a través de un
 * archivo "use server" hacia un client component tiraba un
 * `ReferenceError: X is not defined` en runtime. */
export interface AdvisorSheetConnectionRow {
  id: string;
  advisorClientId: string;
  advisorName: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, AdvisorSyncFieldKey>;
  headerRow: number;
  status: "active" | "paused";
  lastSyncedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
  lastSheetHash: string | null;
  createdAt: string;
}
