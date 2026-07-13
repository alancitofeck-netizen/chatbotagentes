import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface WhatsAppIntegration {
  id: string;
  externalAccountId: string;
  status: string;
  displayName: string | null;
  hasCredentials: boolean;
  createdAt: string;
}

/** Reads from `integration_connections` (0011_integration_connections.sql) —
 * the same table the YCloud webhook resolves workspaces against. Deliberately
 * never selects `credentials_vault_ref`: it's an opaque Vault secret id, not
 * the key itself, but there's no reason to hand it to the client either.
 * `hasCredentials` lets the UI show "configured" without ever reading the
 * plaintext key back (write-only field, same pattern as changing a password). */
export async function getWhatsAppIntegration(workspaceId: string): Promise<WhatsAppIntegration | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("id, external_account_id, status, metadata, created_at, credentials_vault_ref")
    .eq("workspace_id", workspaceId)
    .eq("provider", "ycloud")
    .maybeSingle();

  if (!data) return null;

  const metadata = data.metadata as { display_name?: string | null } | null;
  return {
    id: data.id as string,
    externalAccountId: data.external_account_id as string,
    status: data.status as string,
    displayName: metadata?.display_name ?? null,
    hasCredentials: data.credentials_vault_ref !== null,
    createdAt: data.created_at as string,
  };
}
