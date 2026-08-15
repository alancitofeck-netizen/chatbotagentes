import { createClient } from "@/lib/supabase/server";

/** Not a "use server" module — files with that directive can only export
 * async Server Actions, so this plain synchronous check lives here instead,
 * shared by src/lib/settings/actions.ts and src/lib/ai-agents/actions.ts. */
export function requireManagerRole(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("No tenés permiso para hacer esto.");
  }
}

/** For anything an Agent must be able to manage in THEIR OWN workspace
 * (Google Calendar/Sheets/Drive connect+disconnect, KPI setters/goals) — a
 * self-service signup has no owner/admin at all (provision-workspace.ts),
 * so gating these behind requireManagerRole would make them unusable for
 * that account. The only thing still worth blocking here is a platform
 * admin's "modo supervisor" session (synthetic role "agent" for a workspace
 * they don't really belong to, session.ts) — real member roles are already
 * checked by the underlying RLS/RPC (core.has_workspace_role(...) fails for
 * a supervisor regardless of their synthetic role, since they have no real
 * workspace_members row), but failing fast here gives a clear message
 * instead of a raw Postgres exception. */
export function requireNotSupervising(isSupervising: boolean | undefined) {
  if (isSupervising) {
    throw new Error("Modo supervisor: no podés modificar un workspace que no es el tuyo.");
  }
}

/** Platform admin ("Owner global") check — orthogonal to any single
 * workspace's role, backed by public.platform_admins (see
 * 0039_role_permissions_system.sql). Used to gate the cross-workspace
 * supervisor panel, never to grant write access (RLS keeps platform-admin
 * access read-only regardless of what this returns). */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_platform_admin");
  return Boolean(data);
}

export async function requirePlatformAdmin() {
  if (!(await isPlatformAdmin())) {
    throw new Error("No tenés permiso para hacer esto.");
  }
}

/** `ws_id` es "el workspace real de la agencia" — específicamente aquel
 * donde el platform admin MÁS ANTIGUO (alancitofeck@gmail.com, sembrado en
 * 0039, resuelto acá de forma data-driven vía `order by created_at asc`,
 * nunca hardcodeado) es miembro real. A propósito NO alcanza con "algún
 * platform admin cualquiera": un asesor al que también se le otorgó
 * platform_admin (ver 0144) sería trivialmente "miembro platform admin"
 * de SU PROPIO workspace, lo cual volvía a habilitar por accidente el
 * mismo bug que esto corrige — ver 0144_agency_workspace_fix_original_admin.sql
 * para el root cause completo. */
export async function isAgencyWorkspace(workspaceId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("workspace_has_platform_admin_member", { ws_id: workspaceId });
  return Boolean(data);
}

/** Gate real para "Asesores" (src/lib/clients/actions.ts y las páginas del
 * módulo) — reemplaza el patrón anterior `requireManagerRole(role); await
 * requirePlatformAdmin();`. Ese patrón tenía dos problemas: (1) dejaba el
 * módulo utilizable solo por el Owner global exclusivamente, ni siquiera
 * otro owner/admin real de la MISMA agencia podía usarlo (el bug que pidió
 * corregir el usuario); y (2) al ser platform_admin un check "global" sin
 * atarse a NINGÚN workspace en particular, un platform admin que operaba
 * desde su PROPIO workspace individual (no el de la agencia) terminaba
 * auto-provisionando fichas de otros asesores ahí por error (
 * ensureAdvisorRecordsExist, clients/queries.ts) — la causa real del error
 * genérico que se reportó. Acá, en cambio, siempre exige estar realmente
 * parado en el workspace de la agencia (isAgencyWorkspace), sea cual sea
 * el rol/estatus del que llama. */
export async function requireAgencyManagerRole(workspaceId: string, role: string): Promise<void> {
  requireManagerRole(role);
  if (!(await isAgencyWorkspace(workspaceId))) {
    throw new Error("No tenés permiso para hacer esto.");
  }
}
