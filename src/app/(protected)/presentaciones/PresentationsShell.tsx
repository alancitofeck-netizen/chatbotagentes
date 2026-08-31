"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { PresentationListItem, PresentationsKpis } from "@/lib/presentations/queries";
import { createPresentationAction, duplicatePresentationAction, deletePresentationAction } from "@/lib/presentations/actions";
import { PresentationsKpiHeader } from "./PresentationsKpiHeader";
import { PresentationsTable } from "./PresentationsTable";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

export function PresentationsShell({ initialItems, initialKpis }: { initialItems: PresentationListItem[]; initialKpis: PresentationsKpis }) {
  useAutoStartTour("presentations-intro");
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [kpis] = useState(initialKpis);
  const [creating, setCreating] = useState(false);

  async function handleNew() {
    setCreating(true);
    try {
      const { id } = await createPresentationAction();
      router.push(`/presentaciones/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la presentación.");
      setCreating(false);
    }
  }

  async function handleDuplicate(item: PresentationListItem) {
    try {
      const { id } = await duplicatePresentationAction(item.id);
      toast.success("Presentación duplicada.");
      router.push(`/presentaciones/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar.");
    }
  }

  async function handleDelete(item: PresentationListItem) {
    if (!window.confirm(`¿Eliminar "${item.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deletePresentationAction(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast.success("Presentación eliminada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 sm:px-6 lg:px-8">
      <div>
        <Button onClick={handleNew} loading={creating} data-tour="presentations.new-button">
          <Plus className="size-4" aria-hidden="true" />
          Nueva Presentación
        </Button>
      </div>

      <PresentationsKpiHeader kpis={kpis} />

      <PresentationsTable items={items} onDuplicate={handleDuplicate} onDelete={handleDelete} />
    </div>
  );
}
