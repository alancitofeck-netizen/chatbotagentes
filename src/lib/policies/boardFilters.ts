import type { PolicyBoard } from "@/lib/policies/actions";
import type { PolicyListItem } from "@/lib/policies/queries";
import { ACTIVE_LIKE_STATUSES, type InsuranceType } from "@/lib/policies/constants";

export interface PoliciesFilters {
  status: string;
  insuranceType: InsuranceType | "";
  company: string;
  /** Matched by name, not id — PolicyListItem only carries `ownerName`
   * (same "filter by the literal string already on the card" convention
   * CRM's own boardFilters.ts uses for `company`/`source`, not a real FK
   * lookup), populated from the workspace members list in the UI. */
  ownerName: string;
}

export const EMPTY_POLICIES_FILTERS: PoliciesFilters = {
  status: "",
  insuranceType: "",
  company: "",
  ownerName: "",
};

/** Driven by the 4 clickable KPI tiles (PoliciesKpiHeader.tsx) — only the
 * ones with an unambiguous discrete filter (Prima mensual/anual, Clientes
 * asegurados, Aseguradoras activas stay informational-only, see the tiles'
 * own comment for why). Clicking the same tile again resets to "all". */
export type PolicyQuickFilter = "all" | "active" | "renewals30" | "overdue";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Pure client-side filter over an already-fetched PolicyBoard — both the
 * Tabla and Kanban views read from this so they never disagree on what
 * "matches the current filters" means. Same shape as
 * src/lib/crm/boardFilters.ts's filterAndSortBoard. */
export function filterAndSortPolicyBoard(
  board: PolicyBoard,
  opts: { search: string; filters: PoliciesFilters; quickFilter: PolicyQuickFilter },
): { cardsByStage: Record<string, PolicyListItem[]>; flat: PolicyListItem[] } {
  const { search, filters, quickFilter } = opts;
  const q = search.trim().toLowerCase();
  const now = new Date();
  const in30 = new Date(now.getTime() + THIRTY_DAYS_MS);

  function matches(card: PolicyListItem): boolean {
    if (q) {
      const haystack = [card.policyNumber, card.contactName, card.company, card.product, card.contactPhone, card.contactEmail, card.ownerName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.status && card.status !== filters.status) return false;
    if (filters.insuranceType && card.insuranceType !== filters.insuranceType) return false;
    if (filters.company && card.company !== filters.company) return false;
    if (filters.ownerName && card.ownerName !== filters.ownerName) return false;

    if (quickFilter === "active" && card.status !== "activa") return false;
    if (quickFilter === "overdue" && card.status !== "vencida") return false;
    if (quickFilter === "renewals30") {
      if (!ACTIVE_LIKE_STATUSES.includes(card.status)) return false;
      if (!card.endDate) return false;
      const end = new Date(card.endDate);
      if (!(end >= now && end <= in30)) return false;
    }
    return true;
  }

  const cardsByStage: Record<string, PolicyListItem[]> = {};
  const flat: PolicyListItem[] = [];
  for (const [stageId, cards] of Object.entries(board.cardsByStage)) {
    const filtered = cards.filter(matches);
    cardsByStage[stageId] = filtered;
    flat.push(...filtered);
  }

  return { cardsByStage, flat };
}
