import { Handshake } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/** Etapa "Cita de Cierre" — todavía no existe ningún backend propio para
 * esto (confirmado: no hay tipo de reunión "cierre" en pipelines/bookings/
 * Meeting OS), así que es a propósito solo una estructura visual preparada
 * — sin tabla nueva ni datos inventados. Cuando haya lógica real de cierre,
 * este panel pasa a ser el lugar natural para sumarla, sin tocar
 * Presentación/Cita Inicial. */
export function CitaDeCierrePanel() {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cita de Cierre</h2>
          <p className="text-sm text-neutral-500">Segunda reunión para avanzar con el cierre del prospecto.</p>
        </div>
        <Badge variant="accent">Próximamente</Badge>
      </div>
      <EmptyState
        icon={Handshake}
        title="Esta etapa todavía no está activa"
        description="Cuando sumemos el flujo de Cita de Cierre, vas a poder gestionarla acá — separada de Presentación, siguiendo al mismo prospecto."
      />
    </Card>
  );
}
