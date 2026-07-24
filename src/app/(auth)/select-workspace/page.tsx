import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser, getUserWorkspaces } from "@/lib/auth/session";
import { provisionDefaultWorkspaceIfNeeded } from "@/lib/auth/provision-workspace";
import { AutoSelect } from "./AutoSelect";
import { WorkspacePicker } from "./WorkspacePicker";

export const metadata: Metadata = {
  title: "Selecciona tu workspace — Growth Link",
};

export default async function SelectWorkspacePage() {
  const user = await requireUser();
  let workspaces = await getUserWorkspaces(user.id);

  // Provisioning normally happens right after signup OTP confirmation
  // (src/app/(auth)/confirm-email/actions.ts). A user can land here with
  // zero workspaces if that step was skipped for any reason — retry
  // provisioning here as a safety net instead of dead-ending the user.
  if (workspaces.length === 0 && user.email) {
    await provisionDefaultWorkspaceIfNeeded(user.id, user.email).catch(() => {});
    workspaces = await getUserWorkspaces(user.id);
  }

  if (workspaces.length === 0) {
    return (
      <AuthCard title="No encontramos tu workspace">
        <EmptyState
          icon={TriangleAlert}
          title="Algo salió mal al crear tu workspace"
          description="Vuelve a intentar en unos minutos o contacta a soporte si el problema continúa."
        />
      </AuthCard>
    );
  }

  if (workspaces.length === 1) {
    return <AutoSelect workspaceId={workspaces[0].workspaceId} />;
  }

  return (
    <AuthCard title="Selecciona un workspace" description="Perteneces a más de un workspace de Growth Link.">
      <WorkspacePicker workspaces={workspaces} />
    </AuthCard>
  );
}
