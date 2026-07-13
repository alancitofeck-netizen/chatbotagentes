import type { CrmBoard, OpportunityCard } from "@/lib/crm/queries";
import type { BoardFilters, SortOption } from "@/app/(protected)/crm/BoardActionBar";

/** Pure client-side filter/sort over an already-fetched CrmBoard — both the
 * Kanban and Tabla views read from this so they never disagree on what
 * "matches the current filters" means. `supervisorByOwnerId` comes from the
 * Agentes list (already fetched for the Agentes tab) rather than a new query. */
export function filterAndSortBoard(
  board: CrmBoard,
  opts: { search: string; filters: BoardFilters; sortBy: SortOption; supervisorByOwnerId: Map<string, string | null> },
): { cardsByStage: Record<string, OpportunityCard[]>; flat: OpportunityCard[] } {
  const { search, filters, sortBy, supervisorByOwnerId } = opts;
  const q = search.trim().toLowerCase();

  function matches(card: OpportunityCard): boolean {
    if (q) {
      const haystack = [card.contactName, card.company, card.email, card.phone, card.ownerName, ...card.tags.map((t) => t.name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.stageId && card.stageId !== filters.stageId) return false;
    if (filters.agentId && card.ownerId !== filters.agentId) return false;
    if (filters.priority && card.priority !== filters.priority) return false;
    if (filters.source && card.source !== filters.source) return false;
    if (filters.company && card.company !== filters.company) return false;
    if (filters.tagId && !card.tags.some((t) => t.id === filters.tagId)) return false;
    if (filters.supervisorId) {
      const supervisorId = card.ownerId ? (supervisorByOwnerId.get(card.ownerId) ?? null) : null;
      if (supervisorId !== filters.supervisorId) return false;
    }
    if (filters.valueMin && card.value < Number(filters.valueMin)) return false;
    if (filters.valueMax && card.value > Number(filters.valueMax)) return false;
    if (filters.dateFrom && card.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && card.createdAt.slice(0, 10) > filters.dateTo) return false;
    return true;
  }

  function sort(cards: OpportunityCard[]): OpportunityCard[] {
    const copy = [...cards];
    switch (sortBy) {
      case "value_desc":
        return copy.sort((a, b) => b.value - a.value);
      case "probability_desc":
        return copy.sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1));
      case "name_asc":
        return copy.sort((a, b) => a.contactName.localeCompare(b.contactName));
      case "date_desc":
      default:
        return copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
  }

  const cardsByStage: Record<string, OpportunityCard[]> = {};
  const flat: OpportunityCard[] = [];
  for (const [stageId, cards] of Object.entries(board.cardsByStage)) {
    const filtered = sort(cards.filter(matches));
    cardsByStage[stageId] = filtered;
    flat.push(...filtered);
  }

  return { cardsByStage, flat: sort(flat) };
}
