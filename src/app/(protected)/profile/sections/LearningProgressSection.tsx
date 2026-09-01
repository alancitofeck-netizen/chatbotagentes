"use client";

import { Card } from "@/components/ui/Card";
import { LearningProgress } from "@/components/onboarding/LearningProgress";

/** Perfil → Aprendizaje (§29: "accesible desde el perfil o desde el botón
 * de ayuda") — reusa el mismo componente que ya vive dentro de
 * HelpCenterPanel, sin duplicar la lógica de progreso (LearningProgress ya
 * trae su propio título/porcentaje, por eso no hay un CardHeader extra acá). */
export function LearningProgressSection() {
  return (
    <Card>
      <LearningProgress />
    </Card>
  );
}
