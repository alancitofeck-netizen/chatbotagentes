import { Badge } from "@/components/ui/Badge";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, type PolicyStatus } from "@/lib/policies/constants";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function PolicyHeaderCard({
  contactName,
  status,
  company,
  product,
}: {
  contactName: string;
  status: PolicyStatus;
  company: string;
  product: string | null;
}) {
  const stageName = POLICY_STAGES.find((s) => s.key === status)?.name ?? status;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-primary-600 text-lg font-semibold text-white">
        {initials(contactName)}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-foreground">{contactName}</p>
          <Badge variant={POLICY_STATUS_BADGE_VARIANT[status]}>{stageName}</Badge>
        </div>
        <p className="text-xs text-neutral-500">{company}{product ? ` · ${product}` : ""}</p>
      </div>
    </div>
  );
}
