"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Image as ImageIcon, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { MyProfile } from "@/lib/profile/queries";
import type { ModuleStatus, WorkspaceMember } from "@/lib/settings/queries";
import { updateWorkspaceName } from "@/lib/profile/actions";
import { ModulesSection } from "./ModulesSection";
import { MembersSection } from "./MembersSection";

const ROLE_PERMISSIONS: { role: string; label: string; description: string }[] = [
  { role: "owner", label: "Owner", description: "Control total — miembros, módulos, integraciones y facturación." },
  { role: "admin", label: "Admin", description: "Gestiona miembros, módulos e integraciones. No transfiere la propiedad del workspace." },
  { role: "agent", label: "Agente", description: "Trabaja en Inbox/CRM/ATS. No gestiona miembros ni configuración del workspace." },
  { role: "viewer", label: "Solo lectura", description: "Puede ver información pero no crear, editar ni eliminar nada." },
];

export function WorkspaceSection({
  profile,
  modules,
  members,
  canManage,
  onWorkspaceChanged,
  onModulesChanged,
  onMembersChanged,
}: {
  profile: MyProfile;
  modules: ModuleStatus[];
  members: WorkspaceMember[];
  canManage: boolean;
  onWorkspaceChanged: () => void;
  onModulesChanged: () => void;
  onMembersChanged: () => void;
}) {
  const [name, setName] = useState(profile.workspaceName);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateWorkspaceName(name);
        onWorkspaceChanged();
        toast.success("Nombre del workspace actualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el nombre.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Datos del workspace" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-lg bg-surface-3 text-neutral-400">
              <ImageIcon className="size-6" aria-hidden="true" />
            </span>
            <button
              type="button"
              disabled
              title="Próximamente — requiere Supabase Storage"
              className="text-xs font-medium text-neutral-400 disabled:cursor-not-allowed"
            >
              Cambiar logo (próximamente)
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="Nombre de la empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManage}
              containerClassName="flex-1"
            />
            {canManage && (
              <Button onClick={handleSave} loading={isPending} disabled={name === profile.workspaceName}>
                Guardar
              </Button>
            )}
          </div>

          <p className="text-[13px] text-neutral-500">Identificador: {profile.workspaceSlug}</p>
        </div>
      </Card>

      <ModulesSection modules={modules} canManage={canManage} onChanged={onModulesChanged} />

      <MembersSection members={members} canManage={canManage} onChanged={onMembersChanged} />

      <Card>
        <CardHeader title="Roles y permisos" />
        <ul className="flex flex-col divide-y divide-border-default">
          {ROLE_PERMISSIONS.map((r) => (
            <li key={r.role} className="py-2.5">
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-[13px] text-neutral-500">{r.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-neutral-400">El rol de cada miembro se asigna arriba, en Miembros.</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Sparkles className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Agentes IA</p>
              <p className="text-[13px] text-neutral-500">Asistentes de IA especializados, prompts y herramientas.</p>
            </div>
          </div>
          <Link
            href="/crm?tab=agentes-ia"
            className="flex items-center gap-1 text-sm font-medium text-accent-600 hover:underline"
          >
            Abrir <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
