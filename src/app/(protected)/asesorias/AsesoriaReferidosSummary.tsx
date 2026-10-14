import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Entrada directa a /asesorias/referidos desde la portada de Asesorías —
 * antes solo se llegaba entrando a Presentación y abriendo ahí la KPI
 * "Referidos" (AsesoriaKpiCards.tsx). Los referidos son workspace-wide,
 * no exclusivos de una etapa (asesoria_id es nullable: también incluye
 * los que llegan por Mini Apps y, desde 0196, por Sistema de Referidos —
 * ver asesoria_referrals), así que viven acá como su propia entrada en
 * vez de ir metidos en una de las stage cards. */
export function AsesoriaReferidosSummary({ referidos }: { referidos: number }) {
  return (
    <Link href="/asesorias/referidos" data-tour="asesorias.referidos-link" className="group block">
      <Card className="flex items-center justify-between gap-4 border border-transparent transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--color-info)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-info-bg)] text-[var(--color-info-strong)]">
            <Users className="size-[18px]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {referidos} {referidos === 1 ? "referido" : "referidos"}
            </p>
            <p className="text-[13px] text-neutral-500">Personas referidas por tus prospectos, de todas tus asesorías</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-accent-600">
          Ver referidos
          <ArrowRight className="size-4 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Card>
    </Link>
  );
}
