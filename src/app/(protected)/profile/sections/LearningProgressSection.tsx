"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { LearningProgress } from "@/components/onboarding/LearningProgress";
import { useOnboarding } from "@/components/onboarding/OnboardingContext";

/** Perfil → Aprendizaje (§29: "accesible desde el perfil o desde el botón
 * de ayuda") — reusa el mismo componente que ya vive dentro de
 * HelpCenterPanel, sin duplicar la lógica de progreso (LearningProgress ya
 * trae su propio título/porcentaje, por eso no hay un CardHeader extra acá).
 * "Reiniciar tutoriales" (§31, versión completa) — vuelve todo el
 * checklist inicial y todos los tours/hints a 'pending' para que el
 * usuario pueda volver a recorrerlos desde cero. */
export function LearningProgressSection() {
  const { resetAllProgress } = useOnboarding();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleReset() {
    resetAllProgress();
    setConfirmOpen(false);
    toast.success("Tutoriales reiniciados — vas a volver a verlos a medida que entrás a cada módulo.");
  }

  return (
    <>
      <Card>
        <LearningProgress />
        <div className="mt-4 border-t border-border-default pt-4">
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reiniciar todos los tutoriales
          </Button>
          <p className="mt-1.5 text-xs text-neutral-400">
            Vuelve a marcar como pendiente el checklist inicial y todos los tours de cada módulo — no borra ni modifica ningún dato real.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Reiniciar todos los tutoriales?"
        description="La próxima vez que entres a cada módulo, vas a volver a ver su tour guiado desde el principio."
        confirmLabel="Reiniciar"
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
