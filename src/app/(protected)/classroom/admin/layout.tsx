import type { ReactNode } from "react";
import { forbidden } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth/session";

/** Role gate for the whole Classroom admin panel — same pattern as
 * src/app/(protected)/crm/agents/[memberId]/page.tsx:18. Classroom's catalog
 * is global (no workspace_id), but "can manage" is still read from the
 * caller's role in their currently active workspace (see
 * src/lib/classroom/authz.ts for the full reasoning/known simplification). */
export default async function ClassroomAdminLayout({ children }: { children: ReactNode }) {
  const { role, isSupervising } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin" && !isSupervising) forbidden();
  return children;
}
