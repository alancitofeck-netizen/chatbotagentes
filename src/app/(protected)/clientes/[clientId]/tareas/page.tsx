import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientTasks } from "@/lib/clients/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { ClientTasksBoard } from "./ClientTasksBoard";

export const metadata: Metadata = { title: "Tareas — Cliente — Growth Link" };

export default async function ClientTareasPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const [tasks, members] = await Promise.all([getClientTasks(workspaceId, clientId), getWorkspaceMembers(workspaceId)]);

  return <ClientTasksBoard clientId={clientId} initialTasks={tasks} members={members} />;
}
