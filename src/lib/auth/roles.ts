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

/** Gate real para "Asesores"/Operaciones (src/lib/clients/actions.ts,
 * src/lib/advisorSync/actions.ts y las páginas de esos módulos) — resuelve
 * acceso por USUARIO, no por workspace activo: un owner/admin real de la
 * agencia (core.current_user_agency_role(), security definer + auth.uid(),
 * ver 0152_agency_access_by_user.sql) puede usar estos módulos parado en
 * CUALQUIER workspace propio, sin tener que cambiarse al de la agencia
 * (pedido explícito — antes exigía estar PARADO ahí, ver el reemplazado
 * isAgencyWorkspace/0144). Es seguro sin tocar RLS: `core.is_workspace_member`/
 * `has_workspace_role` ya chequean la fila real de workspace_members para
 * el workspace_id que se consulta, nunca el activo de la sesión — este gate
 * solo cambia CUÁL workspace_id le pasa el código a esas queries.
 * Devuelve `null` (no lanza) para gates de página, que necesitan su propio
 * EmptyState en vez de un error genérico — ver requireAgencyWorkspaceAccess
 * para el equivalente que lanza, usado en Server Actions. */
export async function getAgencyWorkspaceAccessForCurrentUser(): Promise<string | null> {
  const supabase = await createClient();
  const [{ data: role }, { data: agencyWorkspaceId }] = await Promise.all([
    supabase.rpc("current_user_agency_role"),
    supabase.rpc("agency_workspace_id"),
  ]);
  if (role !== "owner" && role !== "admin") return null;
  return (agencyWorkspaceId as string | null) ?? null;
}

export async function requireAgencyWorkspaceAccess(): Promise<string> {
  const workspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!workspaceId) throw new Error("No tenés permiso para hacer esto.");
  return workspaceId;
}
