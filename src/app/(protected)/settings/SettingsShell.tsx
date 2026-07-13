"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import type { ModuleStatus, WorkspaceMember } from "@/lib/settings/queries";
import { getWorkspaceMembersListAction, getWorkspaceModuleStatusAction } from "@/lib/settings/actions";
import { ModulesSection } from "./ModulesSection";
import { MembersSection } from "./MembersSection";

export function SettingsShell({
  initialModules,
  initialMembers,
  currentRole,
}: {
  initialModules: ModuleStatus[];
  initialMembers: WorkspaceMember[];
  currentRole: string;
}) {
  const [modules, setModules] = useState(initialModules);
  const [members, setMembers] = useState(initialMembers);
  const [, startTransition] = useTransition();
  const canManage = currentRole === "owner" || currentRole === "admin";

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
      <div>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          Configuración
        </h1>
        <p className="text-sm text-neutral-500">Módulos activos y miembros de este workspace.</p>
      </div>

      <ModulesSection modules={modules} canManage={canManage} onChanged={refetchModules} />
      <MembersSection members={members} canManage={canManage} onChanged={refetchMembers} />

      <Card>
        <CardHeader title="IA" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Sparkles className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Prompt Builder</p>
              <p className="text-[13px] text-neutral-500">
                Prompts de sistema y tools por módulo — gestión sin ejecución todavía.
              </p>
            </div>
          </div>
          <LinkButton href="/settings/ai" variant="secondary" size="sm">
            Abrir
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
