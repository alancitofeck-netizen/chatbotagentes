import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceTagsWithUsage } from "@/lib/inbox/queries";
import { TagsShell } from "./TagsShell";

export const metadata: Metadata = {
  title: "Etiquetas — Growth Link",
};

export default async function EtiquetasPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const tags = await getWorkspaceTagsWithUsage(workspaceId);

  return <TagsShell initialTags={tags} canDelete={role === "owner" || role === "admin"} />;
}
