import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getPresentationListAction, getPresentationsKpisAction } from "@/lib/presentations/actions";
import { PresentationsShell } from "./PresentationsShell";

export const metadata: Metadata = {
  title: "Crear mi Presentación — Growth Link",
};

export default async function PresentationsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "presentations");

  const [items, kpis] = await Promise.all([getPresentationListAction(), getPresentationsKpisAction()]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">✨ Potenciado con IA</p>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Crear mi Presentación</h1>
        <p className="text-sm text-neutral-500">Generá presentaciones profesionales potenciadas con IA para mostrar a tus clientes.</p>
      </div>
      <PresentationsShell initialItems={items} initialKpis={kpis} />
    </div>
  );
}
