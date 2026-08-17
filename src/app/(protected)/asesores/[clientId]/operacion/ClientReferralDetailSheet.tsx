"use client";

import { Phone, Calendar, UserRound, Presentation } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT } from "../../../asesorias/referidos/referralStatus";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-neutral-500">{icon}</span>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Versión de solo lectura de ReferralDetailSheet (asesorias/referidos/) —
 * esa es editable (dispara updateReferralStatusAction, atada al workspace
 * ACTIVO de la sesión) y linkea a /asesorias/[id] e /inbox/contactos, rutas
 * que también resuelven contra el workspace activo — ninguna de las dos
 * cosas sirve acá (ficha cross-tenant, nunca se entra al workspace del
 * asesor). Todos los datos ya vienen en `referral` (ReferralRow), sin fetch
 * aparte. */
export function ClientReferralDetailSheet({ referral, onClose }: { referral: ReferralRow; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={referral.name}>
      <div className="flex flex-col gap-5 p-5">
        <Badge variant={REFERRAL_STATUS_VARIANT[referral.status]}>{REFERRAL_STATUS_LABEL[referral.status]}</Badge>

        <div className="flex flex-col gap-4">
          <InfoRow icon={<Phone className="size-4" aria-hidden="true" />} label="Teléfono" value={`+${referral.phone}`} />
          <InfoRow icon={<UserRound className="size-4" aria-hidden="true" />} label="Referido por" value={referral.asesoriaName} />
          <InfoRow icon={<Presentation className="size-4" aria-hidden="true" />} label="Asesor" value={referral.advisorName ?? "Sin asignar"} />
          <InfoRow icon={<Calendar className="size-4" aria-hidden="true" />} label="Fecha" value={formatDate(referral.createdAt)} />
        </div>

        {referral.isDuplicate && <p className="text-xs text-warning-strong">Este contacto ya fue referido más de una vez.</p>}
      </div>
    </Sheet>
  );
}
