import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getCrmBoard } from "@/lib/crm/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { KanbanBoard } from "./KanbanBoard";

export const metadata: Metadata = {
  title: "CRM — Growth Link",
};

export default async function CrmPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const board = await getCrmBoard(workspaceId);

  if (!board) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={KanbanSquare}
          title="Todavía no hay un pipeline de ventas"
          description="Se crea automáticamente con tu primera oportunidad."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">CRM</h1>
        <p className="text-sm text-neutral-500">Arrastra las tarjetas para mover una oportunidad de etapa.</p>
      </div>
      <KanbanBoard board={board} />
    </div>
  );
}
