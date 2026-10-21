"use server";

import { requireActiveWorkspace } from "@/lib/auth/session";
import { getCollectionsKpis, type CollectionsKpis } from "@/lib/collections/queries";

/** Lo único que queda de este archivo tras el reemplazo de Cobranza por
 * Finanzas (ver src/lib/finanzas/) — sigue en pie porque `MobileNav.tsx`
 * lo usa para su badge de notificaciones, que todavía lee `policy_payments`
 * (Pólizas → Pagos no se tocó). El resto de las acciones de este archivo
 * (Kanban, ranking por IA, automatizaciones, alta/edición/baja de cobros)
 * se borró junto con la UI de Cobranza. */
export async function getCollectionsKpisAction(): Promise<CollectionsKpis> {
  const { workspaceId } = await requireActiveWorkspace();
  return getCollectionsKpis(workspaceId);
}
