"use client";

import { useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { ModuleStatus } from "@/lib/settings/queries";
import { toggleModule } from "@/lib/settings/actions";

const MODULE_LABELS: Record<string, { name: string; description: string }> = {
  crm: { name: "CRM", description: "Oportunidades de venta sobre el pipeline genérico." },
  ats: { name: "ATS", description: "Vacantes y candidatos para reclutamiento." },
  advisors: { name: "Asesores", description: "Pólizas y clientes para agentes de seguros y asesores financieros." },
};

export function ModulesSection({
  modules,
  canManage,
  onChanged,
}: {
  modules: ModuleStatus[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(module: ModuleStatus) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        await toggleModule(module.moduleKey, !module.enabled);
        onChanged();
        toast.success(module.enabled ? "Módulo desactivado." : "Módulo activado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cambiar el módulo.");
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Módulos" />
      <ul className="flex flex-col divide-y divide-border-default">
        {modules.map((m) => {
          const label = MODULE_LABELS[m.moduleKey] ?? { name: m.moduleKey, description: "" };
          return (
            <li key={m.moduleKey} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{label.name}</p>
                <p className="text-[13px] text-neutral-500">{label.description}</p>
              </div>
              <button
                type="button"
                disabled={!canManage || isPending}
                onClick={() => handleToggle(m)}
                className="disabled:opacity-50"
              >
                <Badge variant={m.enabled ? "success" : "neutral"}>{m.enabled ? "Activo" : "Inactivo"}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
