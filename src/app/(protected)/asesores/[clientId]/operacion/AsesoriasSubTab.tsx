"use client";

import { useState } from "react";
import { Presentation } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AsesoriaListItem } from "@/lib/asesorias/queries";
import { ASESORIA_STATUS_LABEL, ASESORIA_STATUS_VARIANT, formatAsesoriaDuration } from "./operacionHelpers";
import { AsesoriaDetailSheet } from "./AsesoriaDetailSheet";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AsesoriasSubTab({ clientId, asesorias, moduleEnabled }: { clientId: string; asesorias: AsesoriaListItem[]; moduleEnabled: boolean }) {
  const [selected, setSelected] = useState<AsesoriaListItem | null>(null);

  if (!moduleEnabled) {
    return <EmptyState icon={Presentation} title="Módulo Asesorías no habilitado" description="Este asesor no tiene el módulo Asesorías activo en su workspace." />;
  }

  return (
    <Card>
      <CardHeader title="Asesorías" action={<span className="text-xs text-neutral-500">{asesorias.length} en total</span>} />
      {asesorias.length === 0 ? (
        <EmptyState icon={Presentation} title="Sin asesorías todavía" description="Este asesor todavía no registró ninguna asesoría." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-xs text-neutral-500">
                <th className="pb-2 font-medium">Cliente</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Sesión</th>
                <th className="pb-2 font-medium">Última actividad</th>
                <th className="pb-2 font-medium">Duración</th>
                <th className="pb-2 font-medium">Resultado</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {asesorias.map((a) => (
                <tr key={a.id} className="border-t border-border-default">
                  <td className="py-2.5 font-medium text-foreground">{a.contactName ?? a.name}</td>
                  <td className="py-2.5">
                    <Badge variant={ASESORIA_STATUS_VARIANT[a.status]}>{ASESORIA_STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="py-2.5 text-neutral-500">{a.templateName ?? "—"}</td>
                  <td className="py-2.5 text-neutral-500">{formatDate(a.updatedAt)}</td>
                  <td className="py-2.5 text-neutral-500">{formatAsesoriaDuration(a.startedAt, a.completedAt, a.updatedAt)}</td>
                  <td className="py-2.5 text-neutral-500">—</td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={() => setSelected(a)} className="rounded-full border border-border-default px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <AsesoriaDetailSheet key={selected.id} clientId={clientId} asesoria={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}
