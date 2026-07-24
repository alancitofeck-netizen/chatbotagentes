"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getUserWorkspaces } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/auth/roles";
import { setActiveWorkspaceCookie, clearActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** "Administrar"/"Ver Dashboard"/"Ver CRM"/etc. entry points for the Owner
 * global's cross-workspace client list
 * (src/app/(protected)/crm/PlatformWorkspacesTable.tsx, rendered in place of
 * the normal per-workspace Agentes roster for that account) — mirrors
 * selectWorkspace (src/app/(auth)/select-workspace/actions.ts), but
 * authorizes via platform-admin status instead of real membership, since
 * the whole point is entering a workspace the caller does NOT belong to.
 * `redirectPath` picks which page of that workspace to land on — reuses
 * whatever page already exists there (dashboard, CRM, Configuración tabs),
 * no dedicated admin views needed.
 *
 * Deliberately does NOT call redirect() itself — PlatformWorkspacesTable.tsx
 * calls this directly (not via a <form action>), and confirmed live:
 * redirect() thrown from a Server Action invoked that way doesn't reliably
 * navigate (same root cause already fixed once this session for
 * exitSupervisorMode below — a same-URL/direct-call case where Next's
 * client-side handling of the thrown redirect wasn't picked up). The caller
 * does `router.push(redirectPath); router.refresh();` itself after this
 * resolves, which is what actually navigates. */
export async function enterSupervisorMode(workspaceId: string, redirectPath: string = "/dashboard") {
  await requireUser();
  await requirePlatformAdmin();
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath(redirectPath);
}

/** Activar/Desactivar Workspace — Owner global only. Deliberately does NOT
 * redirect (unlike enterSupervisorMode): this is called from
 * PlatformWorkspacesTable.tsx, which stays on /crm?tab=agents and just
 * needs the row's badge to reflect the new status — the caller does
 * `router.refresh()` itself after this resolves (same same-URL Router
 * Cache staleness reason documented on exitSupervisorMode below). No
 * deactivation *enforcement* exists yet (this only flips the display
 * column added in 0042_workspace_status_plan.sql) — that's a deliberate,
 * separate follow-up, not silently assumed here. */
export async function toggleWorkspaceStatus(workspaceId: string, nextStatus: "active" | "inactive") {
  await requireUser();
  await requirePlatformAdmin();
  const serviceClient = createServiceRoleClient();
  const { error } = await serviceClient.from("workspaces").update({ status: nextStatus }).eq("id", workspaceId);
  if (error) throw new Error("No se pudo actualizar el estado del workspace.");
}

/** Restores the platform admin's own workspace (every account, including
 * the Owner global's, still owns its own workspace from registration — see
 * the "un Workspace por usuario" clarification). Falls back to
 * /select-workspace on the off chance the admin has none.
 *
 * Deliberately does NOT call redirect() itself (unlike enterSupervisorMode)
 * — SupervisorModeBanner.tsx calls this directly (not via a <form action>)
 * specifically so it can follow up with router.refresh(). The banner is
 * mounted in (protected)/layout.tsx and can be clicked from /dashboard
 * itself, where redirect("/dashboard") is a same-URL redirect; Next.js's
 * client Router Cache then keeps serving the stale pre-exit (still
 * "supervising") render since nothing tells it that URL's data actually
 * changed — confirmed live: the cookie updates correctly either way, but
 * only a hard reload showed the corrected banner-gone state without this
 * fix. router.refresh() forces the fresh server read every time. */
export async function exitSupervisorMode(): Promise<{ redirectTo: string }> {
  const user = await requireUser();
  const ownWorkspaces = await getUserWorkspaces(user.id);
  if (ownWorkspaces.length === 0) {
    await clearActiveWorkspaceCookie();
    return { redirectTo: "/select-workspace" };
  }
  await setActiveWorkspaceCookie(ownWorkspaces[0].workspaceId);
  return { redirectTo: "/dashboard" };
}
