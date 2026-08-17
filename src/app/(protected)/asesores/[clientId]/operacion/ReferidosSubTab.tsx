"use client";

import { useState } from "react";
import { Users2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT } from "../../../asesorias/referidos/referralStatus";
import { ClientReferralDetailSheet } from "./ClientReferralDetailSheet";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

export function ReferidosSubTab({ referrals, moduleEnabled }: { referrals: ReferralRow[]; moduleEnabled: boolean }) {
  const [selected, setSelected] = useState<ReferralRow | null>(null);

  if (!moduleEnabled) {
    return <EmptyState icon={Users2} title="Módulo Asesorías no habilitado" description="Los referidos se capturan dentro de Asesorías — este asesor no tiene ese módulo activo." />;
  }

  const nuevos = referrals.filter((r) => r.status === "nuevo").length;
  const contactados = referrals.filter((r) => r.status === "contactado").length;
  const convertidos = referrals.filter((r) => r.status === "convertido").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Referidos totales</p>
          <p className="text-lg font-semibold text-foreground">{referrals.length}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Nuevos</p>
          <p className="text-lg font-semibold text-foreground">{nuevos}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Contactados</p>
          <p className="text-lg font-semibold text-foreground">{contactados}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <p className="text-xs text-neutral-500">Convertidos</p>
          <p className="text-lg font-semibold text-foreground">{convertidos}</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Referidos" />
        {referrals.length === 0 ? (
          <EmptyState icon={Users2} title="Sin referidos todavía" description="Este asesor todavía no capturó ningún referido en sus asesorías." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Referido</th>
                  <th className="pb-2 font-medium">De quién viene</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-t border-border-default">
                    <td className="py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="py-2.5 text-neutral-500">{r.asesoriaName}</td>
                    <td className="py-2.5 text-neutral-500">{formatDate(r.createdAt)}</td>
                    <td className="py-2.5">
                      <Badge variant={REFERRAL_STATUS_VARIANT[r.status]}>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      <button type="button" onClick={() => setSelected(r)} className="rounded-full border border-border-default px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && <ClientReferralDetailSheet referral={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
