import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

/** Estado vacío para una página cuyo módulo no está activo en el workspace.
 * Reemplaza el error del servidor que tiraba assertModuleEnabled al renderizar
 * ("This page couldn't load"). Las acciones y rutas de API siguen lanzando. */
export function ModuleDisabledState({ moduleName }: { moduleName: string }) {
  return (
    <div className="p-6">
      <EmptyState icon={Lock} title={moduleName} description="Este módulo no está activo para este workspace." />
    </div>
  );
}
