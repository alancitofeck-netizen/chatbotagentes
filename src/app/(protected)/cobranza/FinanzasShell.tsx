"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";
import type { GastosTabData, FinanzasMovimiento } from "@/lib/finanzas/queries";
import type { FinanzasTipo } from "@/lib/finanzas/constants";
import { FinanzasGastosTab } from "./FinanzasGastosTab";
import { FinanzasCalendarioTab } from "./FinanzasCalendarioTab";
import { FinanzasMovimientoForm } from "./FinanzasMovimientoForm";

/** Orquestador de las 2 pestañas de Finanzas (reemplazo de Cobranza) — dueño
 * del Sheet compartido de alta/edición, que abren ambas pestañas. */
export function FinanzasShell({ initialMonth, initialGastos }: { initialMonth: string; initialGastos: GastosTabData }) {
  useAutoStartTour("collections-intro");
  const [tab, setTab] = useState<"gastos" | "calendario">("gastos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanzasMovimiento | null>(null);
  const [formTipo, setFormTipo] = useState<FinanzasTipo>("out");

  function openCreate(tipo: FinanzasTipo) {
    setEditing(null);
    setFormTipo(tipo);
    setFormOpen(true);
  }
  function openEdit(m: FinanzasMovimiento) {
    setEditing(m);
    setFormTipo(m.tipo);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "gastos" | "calendario")}>
        <div data-tour="finanzas.tabs">
          <TabsList>
            <TabsTrigger value="gastos">Gastos</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
          </TabsList>
        </div>
        <div className="pt-4">
          <TabsContent value="gastos">
            <FinanzasGastosTab
              initialMonth={initialMonth}
              initialData={initialGastos}
              refreshKey={refreshKey}
              onNew={() => openCreate("out")}
              onEdit={openEdit}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
          </TabsContent>
          <TabsContent value="calendario">
            <FinanzasCalendarioTab
              refreshKey={refreshKey}
              onNewCobro={() => openCreate("in")}
              onNewGasto={() => openCreate("out")}
              onEdit={openEdit}
              onChanged={() => setRefreshKey((k) => k + 1)}
            />
          </TabsContent>
        </div>
      </Tabs>

      {formOpen && (
        <FinanzasMovimientoForm
          key={editing?.id ?? `new-${formTipo}`}
          movimiento={editing}
          defaultTipo={formTipo}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
