import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT } from "@/app/(protected)/asesorias/referidos/referralStatus";

/** Solo lectura — mismos datos que /asesorias/referidos, filtrados al
 * asesor de este agente. La edición de estado sigue viviendo en esa
 * pantalla (ReferidosShell.tsx); acá es un vistazo, no se duplica la acción. */
export function ReferralsTab({ referrals }: { referrals: ReferralRow[] }) {
  if (referrals.length === 0) {
    return <EmptyState icon={Users} title="Sin referidos todavía" description="Los referidos asignados a este asesor van a aparecer acá." />;
  }

  return (
    <Card>
      <CardHeader title="Referidos" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs text-neutral-500">
              <th className="pb-2 pr-3 font-medium">Nombre</th>
              <th className="pb-2 pr-3 font-medium">Teléfono</th>
              <th className="pb-2 pr-3 font-medium">Estado</th>
              <th className="pb-2 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id} className="border-b border-border-default last:border-b-0">
                <td className="py-2 pr-3 font-medium text-foreground">{r.name}</td>
                <td className="py-2 pr-3 text-neutral-600">{r.phone}</td>
                <td className="py-2 pr-3">
                  <Badge variant={REFERRAL_STATUS_VARIANT[r.status]}>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                </td>
                <td className="py-2 text-neutral-500">{new Date(r.createdAt).toLocaleDateString("es")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
