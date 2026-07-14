import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getMyProfile, getMySessions } from "@/lib/profile/queries";
import { getWorkspaceMembersList, getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getOpenRouterIntegration, getWhatsAppIntegration } from "@/lib/integrations/queries";
import { getGoogleCalendarStatus } from "@/lib/integrations/googleCalendar";
import { getAutomationList } from "@/lib/automations/queries";
import { ProfileShell } from "./ProfileShell";

export const metadata: Metadata = {
  title: "Perfil — Growth Link",
};

export default async function ProfilePage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  const [profile, sessions, modules, members, whatsapp, googleCalendar, openRouter, automations] = await Promise.all([
    getMyProfile(),
    getMySessions(),
    getWorkspaceModuleStatus(workspaceId),
    getWorkspaceMembersList(workspaceId),
    getWhatsAppIntegration(workspaceId),
    getGoogleCalendarStatus(workspaceId),
    getOpenRouterIntegration(workspaceId),
    getAutomationList(workspaceId),
  ]);

  return (
    <ProfileShell
      initialProfile={profile}
      initialSessions={sessions}
      initialModules={modules}
      initialMembers={members}
      initialWhatsApp={whatsapp}
      initialGoogleCalendar={googleCalendar}
      initialOpenRouter={openRouter}
      initialAutomations={automations}
      currentRole={role}
    />
  );
}
