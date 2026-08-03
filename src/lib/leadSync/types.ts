import type { LeadSyncFieldKey } from "./fieldDictionary";

/** Plain shared type, deliberately not declared in queries.ts (server-only)
 * or actions.ts ("use server") — see src/lib/notifications/types.ts for the
 * production bug this sidesteps: re-exporting a type through a "use server"
 * file's `export type { X };` into a client component produced a
 * `ReferenceError: X is not defined` at runtime (Next's server-reference
 * transform doesn't reliably elide that re-export form). */
export interface LeadSheetConnectionRow {
  id: string;
  spreadsheetId: string;
  sheetGid: string | null;
  sheetName: string;
  columnMap: Record<string, LeadSyncFieldKey>;
  pipelineId: string;
  defaultStageId: string;
  defaultOwnerId: string | null;
  status: "active" | "paused";
  lastSyncedAt: string | null;
  lastSyncStatus: "pending" | "ok" | "error";
  lastSyncError: string | null;
  rowCount: number;
  lastSheetHash: string | null;
}
