import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getCollectionsListAction, getCollectionsKpisAction } from "@/lib/collections/actions";
import { CollectionsShell } from "./CollectionsShell";

export const metadata: Metadata = {
  title: "Cobranza — Growth Link",
};

export default async function CollectionsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "collections");

  const [items, kpis] = await Promise.all([getCollectionsListAction(), getCollectionsKpisAction()]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Cobranza</h1>
        <p className="text-sm text-neutral-500">Centro financiero de toda la cartera</p>
      </div>
      <CollectionsShell initialItems={items} initialKpis={kpis} />
    </div>
  );
}
