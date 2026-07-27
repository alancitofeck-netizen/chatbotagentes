/** Paso 6's checkboxes, plus the two "global default" duplicate-resolution
 * strategies that stand in for a literal per-row Actualizar/Crear nuevo/
 * Omitir choice — reviewing that decision one row at a time doesn't scale
 * to thousands of policies, so the wizard asks for the workspace's default
 * strategy once here; the dozens (not thousands) of insurer/branch/product
 * fuzzy-merge suggestions ARE reviewed individually, in Paso 5
 * (import_job_lookups), where per-item review is actually practical.
 * Vehículos/Viviendas/Vida checkboxes from the original request are
 * deferred with the rest of that scope (confirmed with the user). */
export interface ImportJobConfig {
  createClients: boolean;
  createInsurers: boolean;
  createBranches: boolean;
  createProducts: boolean;
  updateExisting: boolean;
  skipDuplicates: boolean;
  createRenewals: boolean;
  importObservations: boolean;
  assignToCurrentAdvisor: boolean;
  contactDuplicateStrategy: "update" | "create_new" | "skip";
  policyDuplicateStrategy: "update" | "skip" | "duplicate";
}

export const DEFAULT_IMPORT_CONFIG: ImportJobConfig = {
  createClients: true,
  createInsurers: true,
  createBranches: true,
  createProducts: true,
  updateExisting: true,
  skipDuplicates: false,
  createRenewals: true,
  importObservations: true,
  assignToCurrentAdvisor: false,
  contactDuplicateStrategy: "update",
  policyDuplicateStrategy: "update",
};

export interface ImportIssue {
  row: number;
  message: string;
}

/** Paso 4's validation summary — counts + expandable issue lists. */
export interface ImportJobAnalysis {
  totalRows: number;
  clientsFound: number;
  policiesFound: number;
  insurersFound: number;
  branchesFound: number;
  productsFound: number;
  contactDuplicates: number;
  policyDuplicates: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  incomplete: ImportIssue[];
}

export const EMPTY_ANALYSIS: ImportJobAnalysis = {
  totalRows: 0,
  clientsFound: 0,
  policiesFound: 0,
  insurersFound: 0,
  branchesFound: 0,
  productsFound: 0,
  contactDuplicates: 0,
  policyDuplicates: 0,
  errors: [],
  warnings: [],
  incomplete: [],
};

/** Paso 7/8's running + final counts. */
export interface ImportJobTotals {
  clientsCreated: number;
  clientsUpdated: number;
  insurersCreated: number;
  branchesCreated: number;
  productsCreated: number;
  policiesCreated: number;
  policiesUpdated: number;
  errors: number;
}

export const EMPTY_TOTALS: ImportJobTotals = {
  clientsCreated: 0,
  clientsUpdated: 0,
  insurersCreated: 0,
  branchesCreated: 0,
  productsCreated: 0,
  policiesCreated: 0,
  policiesUpdated: 0,
  errors: 0,
};

/** One row's canonical values after Paso 3's mapping is applied — keyed by
 * fieldDictionary.ts's field keys, only the ones actually mapped/present.
 * Persisted as `import_job_rows.data`. */
export type MappedRowData = Partial<Record<string, string>>;

export type ImportJobStatus =
  | "draft"
  | "mapped"
  | "analyzing"
  | "analyzed"
  | "configuring"
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

export type ImportJobPhase = "idle" | "lookups" | "clients" | "policies" | "renewals" | "finalizing" | "done";

export interface ImportJobRecord {
  id: string;
  workspaceId: string;
  sourceFileName: string;
  sourceFileSize: number;
  sheetName: string | null;
  status: ImportJobStatus;
  phase: ImportJobPhase;
  columnMapping: Record<string, string | null>;
  config: ImportJobConfig;
  analysis: ImportJobAnalysis;
  totals: ImportJobTotals;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
