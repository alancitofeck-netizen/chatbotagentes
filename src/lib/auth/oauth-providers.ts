import type { LucideIcon } from "lucide-react";
import { AppWindow, Mail, Terminal } from "lucide-react";

/**
 * OAuth is architected but intentionally not surfaced in the UI yet (see the
 * approved plan for this module). Flip `enabled: true` and render
 * <OAuthButton provider={...} /> in the login/register screens once real
 * OAuth apps are registered with Supabase for each provider. Icons here are
 * neutral placeholders (lucide-react ships no brand/logo icons) — swap for
 * real provider marks whenever these are actually enabled.
 */
export type OAuthProviderId = "google" | "azure" | "github";

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

export const oauthProviders: OAuthProviderConfig[] = [
  { id: "google", label: "Google", icon: Mail, enabled: false },
  { id: "azure", label: "Microsoft", icon: AppWindow, enabled: false },
  { id: "github", label: "GitHub", icon: Terminal, enabled: false },
];
