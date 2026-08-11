import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Operación — Cliente — Growth Link" };

/** Fase 3 del módulo: funnel de LinkedIn + campañas (carga manual, sin
 * integración con la API de LinkedIn hoy) — ver plan del módulo. */
export default function ClientOperacionPage() {
  return (
    <EmptyState
      icon={Link2}
      title="Próximamente"
      description="Funnel de LinkedIn y campañas por nicho — se habilita en la siguiente etapa del módulo."
    />
  );
}
