import type { ReferralStatus } from "@/lib/asesorias/referrals";
import type { BadgeVariant } from "@/components/ui/Badge";

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  no_interesado: "No interesado",
  convertido: "Convertido",
};

export const REFERRAL_STATUS_VARIANT: Record<ReferralStatus, BadgeVariant> = {
  nuevo: "accent",
  contactado: "warning",
  interesado: "info",
  no_interesado: "error",
  convertido: "success",
};

export const REFERRAL_STATUS_OPTIONS: ReferralStatus[] = ["nuevo", "contactado", "interesado", "no_interesado", "convertido"];
