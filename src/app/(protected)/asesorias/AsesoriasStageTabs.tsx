"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { AsesoriaStageOverview, type AsesoriaStage } from "./AsesoriaStageOverview";
import { AsesoriasListShell } from "./AsesoriasListShell";
import { CitaDeCierrePanel } from "./CitaDeCierrePanel";
import type { AsesoriaListItem } from "@/lib/asesorias/queries";

/** Dueño del estado de qué etapa está activa — las cards grandes de
 * AsesoriaStageOverview y la tira de tabs de abajo comparten la misma
 * selección, cambia en el cliente sin recargar la página. */
export function AsesoriasStageTabs({ initialAsesorias }: { initialAsesorias: AsesoriaListItem[] }) {
  const [stage, setStage] = useState<AsesoriaStage>("presentacion");
  const [nowMs] = useState(() => Date.now());

  const totalAsesorias = initialAsesorias.length;
  const lastActivityAt = initialAsesorias.reduce<string | null>((latest, a) => {
    if (!latest) return a.updatedAt;
    return new Date(a.updatedAt) > new Date(latest) ? a.updatedAt : latest;
  }, null);

  return (
    <div className="flex flex-col gap-5">
      <AsesoriaStageOverview
        activeStage={stage}
        onSelectStage={setStage}
        totalAsesorias={totalAsesorias}
        lastActivityAt={lastActivityAt}
        nowMs={nowMs}
      />

      <Tabs value={stage} onValueChange={(v) => setStage(v as AsesoriaStage)}>
        <TabsList>
          <TabsTrigger value="presentacion">01 Presentación · Cita Inicial</TabsTrigger>
          <TabsTrigger value="cierre">02 Cita de Cierre</TabsTrigger>
        </TabsList>
        <div className="pt-5">
          <TabsContent value="presentacion">
            <AsesoriasListShell initialAsesorias={initialAsesorias} />
          </TabsContent>
          <TabsContent value="cierre">
            <CitaDeCierrePanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
