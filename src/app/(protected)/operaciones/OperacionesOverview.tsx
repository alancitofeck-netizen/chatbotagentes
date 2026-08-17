import Link from "next/link";
import { LayoutGrid, Settings2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Mismo lenguaje visual que AsesoriaStageOverview.tsx (Asesorías) —
 * duplicado en vez de compartido a propósito: son módulos independientes,
 * cada uno con su propio ciclo de contenido. Acá no hay stats/CTA de
 * "crear" porque Operaciones no tiene instancias guardadas — son 2
 * herramientas fijas, cada card lleva directo a la suya. */
function ToolCard({
  accent,
  number,
  icon,
  title,
  description,
  href,
  panelIcon,
  available,
}: {
  accent: "violet" | "blue";
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  panelIcon: React.ReactNode;
  available: boolean;
}) {
  const isViolet = accent === "violet";
  return (
    <Card
      variant="default"
      className={`relative flex flex-col gap-5 overflow-hidden border-l-4 ${isViolet ? "border-l-accent-500 bg-gradient-to-br from-[var(--tint-violet-subtle)] to-surface-1" : "border-l-blue-500 bg-gradient-to-br from-[var(--tint-blue-subtle)] to-surface-1"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${isViolet ? "bg-accent-600" : "bg-blue-600"}`}>
            {number}
          </span>
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${isViolet ? "bg-accent-100 text-accent-700" : "bg-blue-100 text-blue-700"}`}>
            {icon}
          </span>
          <div>
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
          </div>
        </div>
        {available ? (
          <span className="flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success-strong">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            Disponible
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning-strong">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            Próximamente
          </span>
        )}
      </div>

      <p className="max-w-xl text-sm text-neutral-600">{description}</p>

      <div className="flex items-center justify-between gap-3 border-t border-border-default pt-4">
        <Link
          href={href}
          className={`flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] ${
            isViolet ? "border-accent-200 text-accent-700 hover:bg-accent-50" : "border-blue-200 text-blue-700 hover:bg-blue-50"
          }`}
        >
          Abrir herramienta
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <span
        className={`pointer-events-none absolute -right-4 top-1/2 hidden size-28 -translate-y-1/2 items-center justify-center rounded-3xl sm:flex ${
          isViolet ? "bg-gradient-to-br from-accent-500 to-accent-700" : "bg-gradient-to-br from-blue-500 to-blue-700"
        }`}
      >
        {panelIcon}
      </span>
    </Card>
  );
}

export function OperacionesOverview() {
  return (
    <div className="flex flex-col gap-4">
      <ToolCard
        accent="violet"
        number="01"
        icon={<LayoutGrid className="size-6" aria-hidden="true" />}
        title="Growth Link OS"
        description="Centro de control interno: personas, tareas, procesos, prioridades y bloqueos del equipo."
        href="/operaciones/herramienta-1"
        panelIcon={<LayoutGrid className="size-10 text-white/90" aria-hidden="true" />}
        available
      />
      <ToolCard
        accent="blue"
        number="02"
        icon={<Settings2 className="size-6" aria-hidden="true" />}
        title="Herramienta 2"
        description="Todavía no se cargó el contenido de esta herramienta."
        href="/operaciones/herramienta-2"
        panelIcon={<Settings2 className="size-10 text-white/90" aria-hidden="true" />}
        available={false}
      />
    </div>
  );
}
