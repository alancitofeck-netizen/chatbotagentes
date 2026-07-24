"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  ShieldCheck,
  SlidersHorizontal,
  Building2,
  Plug,
  CreditCard,
  IdCard,
  Workflow,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils/cn";
import type { MyProfile, MySession } from "@/lib/profile/queries";
import type { ModuleStatus, WorkspaceMember } from "@/lib/settings/queries";
import type { OpenRouterIntegration, WhatsAppIntegration } from "@/lib/integrations/queries";
import type { GoogleCalendarStatus } from "@/lib/integrations/googleCalendar";
import type { GoogleSheetsAccountStatus } from "@/lib/integrations/googleSheets";
import type { GoogleDriveStatus } from "@/lib/integrations/googleDrive";
import type { AutomationListItem } from "@/lib/automations/queries";
import { getMyProfileAction, getMySessionsAction } from "@/lib/profile/actions";
import { getWorkspaceMembersListAction, getWorkspaceModuleStatusAction } from "@/lib/settings/actions";
import { MyProfileSection } from "./sections/MyProfileSection";
import { AccountSection } from "./sections/AccountSection";
import { SecuritySection } from "./sections/SecuritySection";
import { PreferencesSection } from "./sections/PreferencesSection";
import { WorkspaceSection } from "./sections/WorkspaceSection";
import { AutomationsSection } from "./sections/AutomationsSection";
import { IntegrationsSection } from "./sections/IntegrationsSection";
import { BillingSection } from "./sections/BillingSection";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agente",
};

const TABS = [
  { key: "profile", label: "Mi perfil", icon: User },
  { key: "account", label: "Cuenta", icon: IdCard },
  { key: "security", label: "Seguridad", icon: ShieldCheck },
  { key: "preferences", label: "Preferencias", icon: SlidersHorizontal },
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "automations", label: "Automatizaciones", icon: Workflow },
  { key: "integrations", label: "Integraciones", icon: Plug },
  { key: "billing", label: "Facturación", icon: CreditCard },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Perfil = the new account center replacing the old standalone /settings
 * page. Tab state is mirrored into `?tab=` (not just local state) so the
 * avatar dropdown (UserMenu) can deep-link straight into e.g. "Cuenta"
 * instead of always landing on "Mi perfil". */
export function ProfileShell({
  initialProfile,
  initialSessions,
  initialModules,
  initialMembers,
  initialWhatsApp,
  initialGoogleCalendar,
  initialOpenRouter,
  initialAutomations,
  initialGoogleSheets,
  initialGoogleDrive,
  currentRole,
  currentMemberId,
}: {
  initialProfile: MyProfile;
  initialSessions: MySession[];
  initialModules: ModuleStatus[];
  initialMembers: WorkspaceMember[];
  initialWhatsApp: WhatsAppIntegration | null;
  initialGoogleCalendar: GoogleCalendarStatus;
  initialOpenRouter: OpenRouterIntegration | null;
  initialAutomations: AutomationListItem[];
  initialGoogleSheets: GoogleSheetsAccountStatus;
  initialGoogleDrive: GoogleDriveStatus;
  currentRole: string;
  currentMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Derived directly from the URL on every render rather than mirrored into
  // its own state — Next.js reuses this same mounted component for
  // same-route navigations (e.g. UserMenu's "Mi perfil"/"Configuración de
  // cuenta" links, or the redirect from the old /settings), and
  // useSearchParams() itself is already reactive to those navigations, so
  // there's nothing to keep "in sync": this always reflects the current URL.
  const requestedTab = searchParams.get("tab");
  const activeTab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : "profile";

  const [profile, setProfile] = useState(initialProfile);
  const [sessions, setSessions] = useState(initialSessions);
  const [modules, setModules] = useState(initialModules);
  const [members, setMembers] = useState(initialMembers);
  const [, startTransition] = useTransition();

  const canManage = currentRole === "owner" || currentRole === "admin";

  function selectTab(tab: TabKey) {
    router.replace(`/profile?tab=${tab}`, { scroll: false });
  }

  function refetchProfile() {
    startTransition(async () => {
      setProfile(await getMyProfileAction());
    });
  }

  function refetchSessions() {
    startTransition(async () => {
      setSessions(await getMySessionsAction());
    });
  }

  function refetchModules() {
    startTransition(async () => {
      setModules(await getWorkspaceModuleStatusAction());
    });
  }

  function refetchMembers() {
    startTransition(async () => {
      setMembers(await getWorkspaceMembersListAction());
    });
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center gap-3 rounded-lg bg-surface-1 p-8 shadow-[var(--elevation-sm)] sm:flex-row sm:items-center sm:text-left">
        <Avatar name={profile.fullName || profile.email} size={72} />
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <h1 className="text-[19px] font-semibold text-foreground">{profile.fullName || "Tu cuenta"}</h1>
          <p className="text-sm text-neutral-500">
            {profile.email} · {ROLE_LABEL[profile.role] ?? profile.role}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                  active ? "bg-accent-100 text-accent-700" : "text-neutral-600 hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {activeTab === "profile" && <MyProfileSection profile={profile} onChanged={refetchProfile} />}
          {activeTab === "account" && <AccountSection profile={profile} onGoToSecurity={() => selectTab("security")} />}
          {activeTab === "security" && (
            <SecuritySection sessions={sessions} onSessionsChanged={refetchSessions} />
          )}
          {activeTab === "preferences" && <PreferencesSection />}
          {activeTab === "workspace" && (
            <WorkspaceSection
              profile={profile}
              modules={modules}
              members={members}
              canManage={canManage}
              ownMemberId={currentMemberId}
              onWorkspaceChanged={refetchProfile}
              onModulesChanged={refetchModules}
              onMembersChanged={refetchMembers}
            />
          )}
          {activeTab === "automations" && <AutomationsSection initialAutomations={initialAutomations} />}
          {activeTab === "integrations" && (
            <IntegrationsSection
              initialWhatsApp={initialWhatsApp}
              initialGoogleCalendar={initialGoogleCalendar}
              initialOpenRouter={initialOpenRouter}
              initialGoogleSheets={initialGoogleSheets}
              initialGoogleDrive={initialGoogleDrive}
              currentRole={currentRole}
            />
          )}
          {activeTab === "billing" && <BillingSection />}
        </div>
      </div>
    </div>
  );
}
