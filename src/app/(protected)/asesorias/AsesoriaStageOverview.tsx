import Link from "next/link";
import { ArrowRight, ArrowDown, Presentation, Handshake } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

function formatLastActivity(iso: string | null) {
  if (!iso) return "Sin actividad todavía";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Última actividad: ahora";
  if (diffMin < 60) return `Última actividad: hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Última actividad: hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `Última actividad: hace ${diffD} d`;
}

function StageCard({
  href,
  number,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  statusBadge,
  stat,
}: {
  href: string;
  number: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  statusBadge: React.ReactNode;
  stat: React.ReactNode;
}) {
  return (
    <Card
      variant="default"
      className="flex flex-1 flex-col gap-4 border-2 border-transparent transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-border-strong"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex size-11 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
          <div>
            <span className="text-xs font-semibold tracking-wide text-neutral-400">{number}</span>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-neutral-500">{subtitle}</p>
          </div>
        </div>
        {statusBadge}
      </div>
      <div className="text-sm text-neutral-500">{stat}</div>
      <Link
        href={href}
        className="mt-auto flex w-fit items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-3"
      >
        Abrir sesión
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}

/** Dos cards de etapa que llevan a rutas propias (`/asesorias/presentacion`,
 * `/asesorias/cierre`) — mismo patrón "listado → entrás a un detalle" que
 * Mini Apps (`/mini-apps` → `/mini-apps/[miniAppId]`), en vez de mostrar los
 * KPIs/tabla de Presentación ya abiertos en la página raíz del módulo. */
export function AsesoriaStageOverview({ totalAsesorias, lastActivityAt }: { totalAsesorias: number; lastActivityAt: string | null }) {
  return (
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
      <StageCard
        href="/asesorias/presentacion"
        number="01"
        icon={<Presentation className="size-5" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        title="Presentación"
        subtitle="Cita Inicial"
        statusBadge={
          <Badge variant="success" dot>
            Activa
          </Badge>
        }
        stat={
          <>
            {totalAsesorias} {totalAsesorias === 1 ? "asesoría" : "asesorías"}
            <span className="mx-1.5 text-neutral-300">·</span>
            {formatLastActivity(lastActivityAt)}
          </>
        }
      />

      <div className="flex shrink-0 items-center justify-center self-center text-neutral-300">
        <ArrowDown className="size-5 md:hidden" aria-hidden="true" />
        <ArrowRight className="hidden size-5 md:block" aria-hidden="true" />
      </div>

      <StageCard
        href="/asesorias/cierre"
        number="02"
        icon={<Handshake className="size-5" aria-hidden="true" />}
        iconBg="bg-surface-3"
        iconColor="text-neutral-500"
        title="Cita de Cierre"
        subtitle="Segunda reunión"
        statusBadge={<Badge variant="neutral">Próximamente</Badge>}
        stat="Preparado para cuando sumemos esta etapa"
      />
    </div>
  );
}
