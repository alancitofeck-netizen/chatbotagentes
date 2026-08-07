"use client";

import { useEffect, useState } from "react";
import { Workflow, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { AutomationListItem } from "@/lib/automations/queries";
import { getAutomationListAction } from "@/lib/automations/actions";
import { AutomationList } from "@/app/(protected)/profile/sections/AutomationList";
import { AutomationDetailSheet } from "@/app/(protected)/profile/sections/AutomationDetailSheet";
import { CreateAutomationSheet } from "@/app/(protected)/profile/sections/CreateAutomationSheet";

/** "Mis automatizaciones" — el Builder que pidió el usuario ("no hace falta
 * implementarlo completamente, pero debe existir") YA existe de punta a
 * punta: es el mismo motor de src/lib/automations/ (trigger por palabra
 * clave/cualquier mensaje → enviar texto/crear oportunidad/cambiar
 * etapa/asignar tarea), hoy solo visible en Perfil → Automatizaciones. Acá
 * se reusan sus mismos componentes/acciones tal cual — cero lógica nueva —
 * para que también aparezca en este módulo, con su propio empty state.
 *
 * `createOpen`/`onCreateOpenChange` los controla el padre (en vez de un
 * estado local sincronizado por efecto) porque el botón "+ Nueva
 * automatización" del header vive fuera de este componente y no siempre lo
 * remonta (si ya estás en la pestaña "Mis automatizaciones", tocarlo no
 * cambia de pestaña) — controlado evita el efecto. */
export function MyAutomationsTab({ createOpen, onCreateOpenChange }: { createOpen: boolean; onCreateOpenChange: (open: boolean) => void }) {
  const [automations, setAutomations] = useState<AutomationListItem[] | null>(null);
  const [selected, setSelected] = useState<AutomationListItem | null>(null);

  function refetch() {
    getAutomationListAction().then(setAutomations);
  }

  useEffect(() => {
    refetch();
  }, []);

  if (automations === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {automations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No tenés automatizaciones personalizadas."
          description="Creá tu propia regla con el Builder: elegí un disparador y una acción."
          action={
            <Button size="sm" onClick={() => onCreateOpenChange(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Crear automatización
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <AutomationList automations={automations} onSelect={setSelected} onToggled={refetch} />
        </div>
      )}

      <AutomationDetailSheet
        key={selected?.id ?? "closed"}
        automation={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          refetch();
          setSelected(null);
        }}
      />
      <CreateAutomationSheet open={createOpen} onClose={() => onCreateOpenChange(false)} onCreated={refetch} />
    </div>
  );
}
