"use client";

import { useState } from "react";
import { Phone, Calendar, UserRound, Presentation, ArrowUpRight, Rocket } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { LinkButton } from "@/components/ui/LinkButton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { ReferralRow, ReferralStatus } from "@/lib/asesorias/referrals";
import { updateReferralStatusAction } from "@/lib/asesorias/actions";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT, REFERRAL_STATUS_OPTIONS } from "./referralStatus";
import { StartReferralConversationDialog } from "./StartReferralConversationDialog";

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

export function ReferralDetailSheet({
  referral,
  onClose,
  onStatusUpdated,
}: {
  referral: ReferralRow;
  onClose: () => void;
  onStatusUpdated: (referralId: string, status: ReferralStatus) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [startConversationOpen, setStartConversationOpen] = useState(false);

  async function handleStatusChange(status: ReferralStatus) {
    setIsPending(true);
    try {
      await updateReferralStatusAction(referral.id, status);
      onStatusUpdated(referral.id, status);
      toast.success("Estado actualizado.");
    } catch {
      toast.error("No se pudo actualizar el estado.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={referral.name}>
      <div className="flex flex-col gap-5 p-5">
        <Badge variant={REFERRAL_STATUS_VARIANT[referral.status]}>{REFERRAL_STATUS_LABEL[referral.status]}</Badge>

        <div className="flex flex-col gap-4">
          <InfoRow icon={<Phone className="size-4" aria-hidden="true" />} label="Teléfono" value={`+${referral.phone}`} />
          <InfoRow icon={<UserRound className="size-4" aria-hidden="true" />} label="Referido por" value={referral.asesoriaName} />
          <InfoRow icon={<Presentation className="size-4" aria-hidden="true" />} label="Asesoría" value="Presentación — Cita Inicial" />
          <InfoRow icon={<UserRound className="size-4" aria-hidden="true" />} label="Asesor" value={referral.advisorName ?? "Sin asignar"} />
          <InfoRow icon={<Calendar className="size-4" aria-hidden="true" />} label="Fecha" value={formatDate(referral.createdAt)} />
        </div>

        <Select
          label="Estado"
          value={referral.status}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as ReferralStatus)}
        >
          {REFERRAL_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {REFERRAL_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>

        {referral.referredContactId && (
          <Button onClick={() => setStartConversationOpen(true)} fullWidth>
            <Rocket className="size-4" aria-hidden="true" />
            Iniciar conversación
          </Button>
        )}

        <div className="flex flex-col gap-2 border-t border-border-default pt-4">
          {referral.asesoriaId && (
            <LinkButton href={`/asesorias/${referral.asesoriaId}/resumen`} variant="secondary" fullWidth>
              Ver asesoría
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </LinkButton>
          )}
          {referral.referredContactId && (
            <LinkButton href={`/inbox/contactos?contact=${referral.referredContactId}`} variant="secondary" fullWidth>
              Ver prospecto
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </LinkButton>
          )}
        </div>
      </div>

      {startConversationOpen && (
        <StartReferralConversationDialog referral={referral} onClose={() => setStartConversationOpen(false)} onSent={() => handleStatusChange("contactado")} />
      )}
    </Sheet>
  );
}
