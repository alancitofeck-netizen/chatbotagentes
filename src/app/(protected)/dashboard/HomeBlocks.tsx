import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import type { CrmBoard } from "@/lib/crm/queries";
import type { AgentListItem } from "@/lib/agents/queries";
import type { AdvisorStatus, AdvisorStatusResult } from "@/lib/insights/advisorStatus";

/** Ranking de mini apps por leads reales (MiniAppListItem.leadsCount). Sin
 * datos de ejemplo: si ninguna trajo leads, lo dice. */
export function MiniAppsRankingCard({ apps }: { apps: MiniAppListItem[] }) {
  const top = apps
    .filter((a) => a.leadsCount > 0)
    .sort((a, b) => b.leadsCount - a.leadsCount)
    .slice(0, 4);
  const max = top[0]?.leadsCount ?? 0;

  return (
    <Card>
      <CardHeader
        title="Mini apps que traen leads"
        action={<Link href="/mini-apps" className="text-sm font-medium text-accent-700 hover:underline">Ver todas</Link>}
      />
      {top.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía ninguna mini app trajo leads.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {top.map((a) => {
            const convertedPct = a.leadsCount > 0 ? Math.round((a.convertedLeadsCount / a.leadsCount) * 100) : 0;
            return (
              <li key={a.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">{a.name}</span>
                  <span className="font-display text-lg font-semibold tabular-nums text-foreground">{a.leadsCount}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-accent-100">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.round((a.leadsCount / max) * 100)}%` }} />
                </div>
                <p className="text-xs text-neutral-500">{convertedPct}% convertidos a cliente</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Embudo del pipeline de ventas a partir del tablero real del CRM: cuántas
 * oportunidades hay abiertas, cuántas pasaron de la primera etapa, cuántas
 * están ganadas y la conversión del mes. */
export function FunnelCard({ board }: { board: CrmBoard | null }) {
  if (!board) return null;
  const stages = board.stages;
  const count = (stageId: string) => board.cardsByStage[stageId]?.length ?? 0;
  const open = stages.filter((s) => !s.isLost);
  const firstId = open[0]?.id;
  const inPipeline = open.reduce((sum, s) => sum + count(s.id), 0);
  const pastFirst = open.filter((s) => s.id !== firstId).reduce((sum, s) => sum + count(s.id), 0);
  const won = stages.filter((s) => s.isWon).reduce((sum, s) => sum + count(s.id), 0);

  const tiles = [
    { label: "En el pipeline", value: inPipeline },
    { label: "Pasaron la primera etapa", value: pastFirst },
    { label: "Ganadas", value: won },
    { label: "Conversión del mes", value: `${Math.round(board.kpis.monthlyConversionRate)}%` },
  ];

  return (
    <Card>
      <CardHeader
        title="Del lead a la venta"
        action={<Link href="/crm" className="text-sm font-medium text-accent-700 hover:underline">CRM</Link>}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border-default bg-surface-2 p-3">
            <p className="font-display text-[26px] leading-none font-semibold tabular-nums text-foreground">{t.value}</p>
            <p className="mt-2 text-xs leading-tight text-neutral-500">{t.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-neutral-600">
        <span className="font-medium text-foreground tabular-nums">{board.kpis.totalPipelineValue.toLocaleString("es-AR")}</span> de valor en el pipeline
      </p>
    </Card>
  );
}

const ADVISOR_BADGE: Record<AdvisorStatus, { label: string; variant: BadgeVariant }> = {
  excelente: { label: "Activo", variant: "success" },
  atencion: { label: "Atención", variant: "warning" },
  sin_actividad: { label: "Sin actividad", variant: "error" },
};

/** Equipo de hoy: el estado de cada asesor sale de computeAdvisorStatus, la
 * misma lógica que el panel de Rendimiento de Asesores de más abajo. */
export function TeamTodayCard({ advisors }: { advisors: (AgentListItem & AdvisorStatusResult)[] }) {
  if (advisors.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Tu equipo hoy" />
      <ul className="flex flex-col divide-y divide-border-default">
        {advisors.slice(0, 5).map((a) => {
          const badge = ADVISOR_BADGE[a.advisorStatus];
          return (
            <li key={a.memberId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Avatar name={a.fullName} src={a.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.fullName}</p>
                <p className="truncate text-xs text-neutral-500">{a.sentence}</p>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
