import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users2 } from "lucide-react";
import type { AgentListItem } from "@/lib/agents/queries";
import type { AdvisorStatusResult } from "@/lib/insights/advisorStatus";

const STATUS_EMOJI: Record<AdvisorStatusResult["advisorStatus"], string> = {
  excelente: "🟢",
  atencion: "🟠",
  sin_actividad: "🔴",
};
const STATUS_LABEL: Record<AdvisorStatusResult["advisorStatus"], string> = {
  excelente: "Excelente",
  atencion: "Atención",
  sin_actividad: "Sin actividad",
};

export type AdvisorCardData = AgentListItem & AdvisorStatusResult;

/** Owner-only section — mirrors the plain `isOwner`-prop-gating convention
 * already used across CRM (AgentsList.tsx/CrmPageShell.tsx), no new
 * abstraction. Renders nothing at all for non-Owners. */
export function AdvisorPerformance({ isOwner, advisors }: { isOwner: boolean; advisors: AdvisorCardData[] }) {
  if (!isOwner) return null;

  return (
    <Card>
      <CardHeader title="Rendimiento de Asesores" />
      {advisors.length === 0 ? (
        <EmptyState icon={Users2} title="Todavía no hay asesores" description="Invita miembros a tu workspace para ver su rendimiento acá." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-default">
          {advisors.map((advisor) => (
            <li key={advisor.memberId} className="flex items-center gap-3 py-3">
              <Avatar name={advisor.fullName} src={advisor.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{advisor.fullName}</p>
                <p className="truncate text-[13px] text-neutral-500">{advisor.sentence}</p>
              </div>
              <Badge variant={advisor.badgeVariant}>
                {STATUS_EMOJI[advisor.advisorStatus]} {STATUS_LABEL[advisor.advisorStatus]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
