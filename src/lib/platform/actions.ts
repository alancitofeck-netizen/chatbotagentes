"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, getUserWorkspaces } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/auth/roles";
import { setActiveWorkspaceCookie, clearActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";

/** "Ver Dashboard" entry point for the Owner global's supervision panel
 * (src/app/(protected)/admin/workspaces/page.tsx) — mirrors selectWorkspace
 * (src/app/(auth)/select-workspace/actions.ts) exactly, but authorizes via
 * platform-admin status instead of real membership, since the whole point
 * is entering a workspace the caller does NOT belong to. Reuses the exact
 * same /dashboard the real owner/agent sees (session.ts's
 * getActiveWorkspaceForUser resolves the synthetic supervising membership
 * from this same cookie on every subsequent request). */
export async function enterSupervisorMode(workspaceId: string) {
  await requireUser();
  await requirePlatformAdmin();
  await setActiveWorkspaceCookie(workspaceId);
  // Busts the client Router Cache for the whole (protected) layout subtree
  // (Sidebar/Navbar/dashboard all depend on the active-workspace cookie) —
  // without this, exitSupervisorMode's redirect("/dashboard") below is a
  // same-URL redirect when clicked from the dashboard itself, and Next.js
  // would otherwise keep serving the cached pre-exit (still-supervising)
  // render until the next unrelated navigation or a hard reload.
  revalidatePath("/dashboard");
  redirect("/dashboard");
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
