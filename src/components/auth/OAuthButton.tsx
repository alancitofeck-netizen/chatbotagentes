"use client";

import type { OAuthProviderConfig } from "@/lib/auth/oauth-providers";
import { Button } from "@/components/ui/Button";

/**
 * Ready to use once a provider's `enabled` flag flips to true (see
 * src/lib/auth/oauth-providers.ts) — not rendered anywhere yet per the
 * approved plan for this module. Calls Supabase's signInWithOAuth via a
 * Server Action once wired up; left as a stub button for now.
 */
export function OAuthButton({ provider }: { provider: OAuthProviderConfig }) {
  const Icon = provider.icon;
  return (
    <Button type="button" variant="secondary" fullWidth disabled={!provider.enabled}>
      <Icon className="size-4" aria-hidden="true" />
      Continuar con {provider.label}
    </Button>
  );
}
