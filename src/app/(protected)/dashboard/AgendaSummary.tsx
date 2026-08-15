import { CalendarCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import type { AgendaPerformance } from "@/lib/agenda/queries";

/** Aviso mínimo de que el workspace tiene una Agenda (citas de asesores
 * sincronizadas desde Google Sheets, ver src/lib/advisorSync) — no
 * reemplaza "Próximas reuniones" (bookings/Google Calendar, que se deja
 * intacto), solo suma un acceso rápido con el total del mes. */
export function AgendaSummary({ data }: { data: AgendaPerformance | null }) {
  const total = data?.totals.total ?? 0;
  const pendientes = data ? data.totals.agendada + data.totals.confirmada : 0;

  return (
    <Card>
      <CardHeader title="Agenda" />
      {total === 0 ? (
        <EmptyState icon={CalendarCheck} title="Sin citas este mes" description="Todavía no hay citas sincronizadas en tu Agenda." />
      ) : (
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-2xl font-semibold text-foreground">{total}</span>
            <span className="text-[12px] text-neutral-500">citas este mes</span>
          </div>
          <div className="h-9 w-px bg-border-default" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="font-mono text-2xl font-semibold text-foreground">{pendientes}</span>
            <span className="text-[12px] text-neutral-500">pendientes</span>
          </div>
        </div>
      )}
      <LinkButton href="/agenda" variant="secondary" size="sm" className="mt-3 w-full justify-center">
        Ver Agenda
      </LinkButton>
    </Card>
  );
}
