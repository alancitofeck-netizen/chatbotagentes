import type { ReactNode } from "react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getTaskGroups } from "@/lib/tasks/groups/queries";
import { TasksModuleShell } from "./TasksModuleShell";

/** Hosts the Tasks/Workspace module's chrome (sidebar with the Grupos list +
 * top bar with "Nuevo"/IA toggle) around every /tasks/* page — same "nested
 * layout for a module's own chrome" pattern already used by Inbox
 * (src/app/(protected)/inbox/layout.tsx). The Grupos list is fetched once
 * here since the sidebar needs it on every page under this segment. */
export default async function TasksLayout({ children }: { children: ReactNode }) {
  const { workspaceId } = await requireActiveWorkspace();
  const groups = await getTaskGroups(workspaceId);

  return <TasksModuleShell groups={groups}>{children}</TasksModuleShell>;
}
