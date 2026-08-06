import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { PolicyExtractionShell } from "./PolicyExtractionShell";

export const metadata: Metadata = {
  title: "Extracción IA — Growth Link",
};

export default async function PolicyExtractionPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "policy_extraction");

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PolicyExtractionShell workspaceId={workspaceId} />
      </div>
    </div>
  );
}
