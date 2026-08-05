import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket } from "@/lib/collections/constants";

export type CollectionsQuickFilter = "all" | "pending" | "overdue" | "upcoming" | "paidThisMonth";

function matchesQuickFilter(item: CollectionItem, quickFilter: CollectionsQuickFilter): boolean {
  if (quickFilter === "all") return true;
  const bucket = deriveCollectionBucket(item.status, item.dueDate);
  if (quickFilter === "overdue") return bucket === "vencido";
  if (quickFilter === "upcoming") return bucket === "proximo";
  if (quickFilter === "pending") return item.status === "pendiente" || item.status === "en_seguimiento";
  if (quickFilter === "paidThisMonth") {
    if (item.status !== "pagado" || !item.paidAt) return false;
    const now = new Date();
    const paid = new Date(item.paidAt);
    return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
  }
  return true;
}

function matchesSearch(item: CollectionItem, search: string): boolean {
  if (!search.trim()) return true;
  const needle = search.trim().toLowerCase();
  return [item.contactName, item.company, item.policyNumber, item.product, item.ownerName, item.contactPhone]
    .filter(Boolean)
    .some((field) => (field as string).toLowerCase().includes(needle));
}

export function filterCollections(items: CollectionItem[], search: string, quickFilter: CollectionsQuickFilter): CollectionItem[] {
  return items.filter((item) => matchesSearch(item, search) && matchesQuickFilter(item, quickFilter));
}
