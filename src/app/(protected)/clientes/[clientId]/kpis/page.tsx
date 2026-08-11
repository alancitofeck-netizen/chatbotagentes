import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "KPIs — Cliente — Growth Link" };

/** Fase 3 del módulo: funnel completo (conexiones → aceptadas →
 * respondieron → interesados → citas → shows → ventas) filtrable por
 * 7d/30d/90d/todo el contrato — ver plan del módulo. */
export default function ClientKpisPage() {
  return (
    <EmptyState
      icon={BarChart3}
      title="Próximamente"
      description="Funnel completo de KPIs de LinkedIn con filtros por período — se habilita en la siguiente etapa del módulo."
    />
  );
}
