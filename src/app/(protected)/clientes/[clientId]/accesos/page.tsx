import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Accesos — Cliente — Growth Link" };

/** Fase 4 del módulo: credenciales cifradas vía Supabase Vault + flujo de
 * revelado con reautenticación y auditoría — deliberadamente al final por
 * ser la mayor superficie de riesgo del módulo. Ver plan del módulo. */
export default function ClientAccesosPage() {
  return (
    <EmptyState
      icon={KeyRound}
      title="Próximamente"
      description="Accesos y credenciales cifradas (LinkedIn, Sales Navigator, Meta Ads, etc.) — se habilita en la siguiente etapa del módulo."
    />
  );
}
