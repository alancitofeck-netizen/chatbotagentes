"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { CollectionItem, CollectionsKpis } from "@/lib/collections/queries";
import { getCollectionsListAction, getCollectionsKpisAction, cancelCollectionAction } from "@/lib/collections/actions";
import { CollectionsKpiHeader } from "./CollectionsKpiHeader";
import { CollectionsActionBar, type CollectionsView } from "./CollectionsActionBar";
import { CollectionsTable } from "./CollectionsTable";
import { CollectionsKanban } from "./CollectionsKanban";
import { CollectionsCalendarView } from "./CollectionsCalendarView";
import { CollectionsPriorityView } from "./CollectionsPriorityView";
import { CollectionDetailDrawer } from "./CollectionDetailDrawer";
import { CollectionFormSheet } from "./CollectionFormSheet";
import { CollectionAutomationsSheet } from "./CollectionAutomationsSheet";
import { filterCollections, type CollectionsQuickFilter } from "./collectionsFilters";

export function CollectionsShell({ initialItems, initialKpis }: { initialItems: CollectionItem[]; initialKpis: CollectionsKpis }) {
  const [items, setItems] = useState(initialItems);
  const [kpis, setKpis] = useState(initialKpis);
  const [view, setView] = useState<CollectionsView>("table");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<CollectionsQuickFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [kanbanKey, setKanbanKey] = useState(0);

  const filtered = useMemo(() => filterCollections(items, search, quickFilter), [items, search, quickFilter]);

  async function refreshAll() {
    const [freshItems, freshKpis] = await Promise.all([getCollectionsListAction(), getCollectionsKpisAction()]);
    setItems(freshItems);
    setKpis(freshKpis);
    setKanbanKey((k) => k + 1);
  }

  async function handleCancelFromTable(item: CollectionItem) {
    if (!window.confirm(`¿Cancelar el cobro de ${item.contactName}?`)) return;
    try {
      await cancelCollectionAction(item.id);
      toast.success("Cobro cancelado.");
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  if (items.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={CircleDollarSign}
          title="Todavía no hay cobros cargados"
          description="Los cobros se generan desde el tab Pagos de cada póliza, o creá uno nuevo acá mismo."
          action={
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
            >
              Nuevo cobro
            </button>
          }
        />
        {formOpen && <CollectionFormSheet onClose={() => setFormOpen(false)} onSaved={refreshAll} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <CollectionsKpiHeader kpis={kpis} quickFilter={quickFilter} onQuickFilterChange={setQuickFilter} />
        <CollectionsActionBar
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={setSearch}
          onNewCollection={() => setFormOpen(true)}
          onOpenAutomations={() => setAutomationsOpen(true)}
        />
      </div>

      {view === "table" && (
        <div className="px-4 sm:px-6 lg:px-8">
          <CollectionsTable
            items={filtered}
            onOpen={(item) => setDetailId(item.id)}
            onRegisterPayment={(item) => setDetailId(item.id)}
            onReschedule={(item) => setDetailId(item.id)}
            onCancel={handleCancelFromTable}
          />
        </div>
      )}
      {view === "kanban" && <CollectionsKanban key={kanbanKey} items={filtered} onOpen={(item) => setDetailId(item.id)} onChanged={refreshAll} />}
      {view === "calendar" && (
        <div className="px-4 sm:px-6 lg:px-8">
          <CollectionsCalendarView items={filtered} onOpen={(item) => setDetailId(item.id)} />
        </div>
      )}
      {view === "priority" && <CollectionsPriorityView onOpen={setDetailId} />}

      <CollectionDetailDrawer paymentId={detailId} onClose={() => setDetailId(null)} onChanged={refreshAll} />

      {formOpen && <CollectionFormSheet onClose={() => setFormOpen(false)} onSaved={refreshAll} />}

      <CollectionAutomationsSheet open={automationsOpen} onClose={() => setAutomationsOpen(false)} />
    </div>
  );
}
