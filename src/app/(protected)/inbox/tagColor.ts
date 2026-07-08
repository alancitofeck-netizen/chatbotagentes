import type { BadgeVariant } from "@/components/ui/Badge";

const VALID_VARIANTS: readonly BadgeVariant[] = ["neutral", "accent", "success", "warning", "error"];

/** tags.color (supabase/migrations/0003_inbox.sql) is free text — map it to a
 * known Badge variant, falling back to neutral for anything unrecognized. */
export function tagBadgeVariant(color: string): BadgeVariant {
  return (VALID_VARIANTS as readonly string[]).includes(color) ? (color as BadgeVariant) : "neutral";
}
