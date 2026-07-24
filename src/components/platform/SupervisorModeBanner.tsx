"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { exitSupervisorMode } from "@/lib/platform/actions";

/** Shown across the whole (protected) layout whenever the active workspace
 * is a synthetic "modo supervisor" membership (session.ts's isSupervising)
 * — makes it visually unmistakable that the Owner global is looking at
 * someone else's Workspace, since the rest of the app (dashboard, KPIs,
 * Inbox, etc.) renders completely unchanged otherwise.
 *
 * Calls exitSupervisorMode directly (not via a <form action>) so it can
 * follow up with router.push + router.refresh() — needed because this
 * banner can be clicked from /dashboard itself, where a server-side
 * redirect("/dashboard") is a same-URL no-op that Next.js's client Router
 * Cache doesn't know to invalidate (confirmed live: the cookie always
 * updates correctly, but only an explicit refresh — not the redirect
 * alone — reliably clears the stale "still supervising" render). */
export function SupervisorModeBanner({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleExit() {
    startTransition(async () => {
      const { redirectTo } = await exitSupervisorMode();
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-warning-bg px-4 py-2 text-sm text-warning-strong sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>
          Modo supervisor — estás viendo el Workspace <strong>{workspaceName}</strong> de solo lectura.
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={isPending}
        className="shrink-0 font-medium underline underline-offset-2 hover:no-underline disabled:opacity-60"
      >
        Salir del modo supervisor
      </button>
    </div>
  );
}
