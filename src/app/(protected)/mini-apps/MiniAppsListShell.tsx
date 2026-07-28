"use client";

import { useState } from "react";
import Link from "next/link";
import { AppWindow, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppsListAction } from "@/lib/miniApps/actions";
import { NewMiniAppWizard } from "./NewMiniAppWizard";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function MiniAppsListShell({
  initialMiniApps,
  members,
  moduleEnabled,
}: {
  initialMiniApps: MiniAppListItem[];
  members: WorkspaceMemberOption[];
  moduleEnabled: boolean;
}) {
  const [miniApps, setMiniApps] = useState(initialMiniApps);
  const [showCreate, setShowCreate] = useState(false);

  async function refetch() {
    setMiniApps(await getMiniAppsListAction());
  }

  if (!moduleEnabled) {
    return (
      <EmptyState
        icon={AppWindow}
        title="El módulo Mini Apps no está activo"
        description="Activalo desde tu perfil, en Configuración > Módulos, para empezar a crear mini apps."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} aria-hidden="true" />
          Nueva Mini App
        </Button>
      </div>

      {miniApps.length === 0 ? (
        <EmptyState
          icon={AppWindow}
          title="Todavía no hay mini apps"
          description="Creá la primera para empezar a recibir leads de un simulador o formulario público."
          action={<Button onClick={() => setShowCreate(true)}>Nueva Mini App</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {miniApps.map((app) => (
            <Link key={app.id} href={`/mini-apps/${app.id}`}>
              <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-[var(--elevation-md)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[15px] font-semibold text-foreground">{app.name}</h3>
                    {app.description && <p className="mt-0.5 text-[13px] text-neutral-500">{app.description}</p>}
                  </div>
                  <Badge variant={app.status === "active" ? "success" : "neutral"}>
                    {app.status === "active" ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <div className="mt-auto flex items-center justify-between text-[13px] text-neutral-500">
                  <span>{app.assignedAgentName ?? "Sin asesor asignado"}</span>
                  <span>{app.leadsCount} lead{app.leadsCount === 1 ? "" : "s"}</span>
                </div>
                <div className="text-xs text-neutral-400">Creada el {formatDate(app.createdAt)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <NewMiniAppWizard members={members} onClose={() => setShowCreate(false)} onCreated={refetch} />}
    </div>
  );
}
