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
  advisors: { name: "Prospectos", description: "Pipeline de prospectos y clientes para agentes de seguros y asesores financieros." },
  mini_apps: { name: "Mini Apps", description: "Simuladores y formularios públicos que capturan leads para el CRM." },
  tasks: { name: "Tareas", description: "Workspace de productividad: tareas, checklists, comentarios y archivos." },
  insurance_prospects: { name: "Posibles Pólizas", description: "Prospectos de seguro capturados desde Mini Apps, calculadoras y formularios." },
  policies: { name: "Pólizas", description: "Gestión completa de pólizas activas: prima, comisión, coberturas, vencimientos y renovaciones." },
  asesorias: { name: "Asesorías", description: "Reuniones guiadas con el prospecto (Meeting OS) — se guardan solas y quedan en el historial del contacto." },
  collections: { name: "Cobranza", description: "Centro financiero: pagos, recibos, vencimientos, renovaciones y comisiones de toda la cartera." },
  policy_extraction: { name: "Extracción IA", description: "Subí el PDF de una póliza y la IA completa los datos clave listos para guardar en Pólizas." },
  goals: { name: "Metas y Bonificaciones", description: "Objetivos de producción, ranking entre asesores, logros y proyecciones de cumplimiento." },
  ai_assistant: { name: "Asistente IA", description: "Copiloto in-app: consultá y ejecutá acciones en el CRM por chat, con tarjetas proactivas de prioridades y alertas." },
  insurance_providers: { name: "Conexión con Aseguradoras", description: "Centro de integraciones: sincronizá tu cartera cargando los exports de cada aseguradora." },
  data_transfer: { name: "Importar / Exportar", description: "Centro de migración: importá tu cartera, exportá tus datos y sincronizá con Google Sheets/Drive." },
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
