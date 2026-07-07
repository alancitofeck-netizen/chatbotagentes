"use client";

import { useTransition } from "react";
import { Building2 } from "lucide-react";
import type { WorkspaceMembership } from "@/lib/auth/session";
import { selectWorkspace } from "./actions";

export function WorkspacePicker({ workspaces }: { workspaces: WorkspaceMembership[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {workspaces.map((workspace) => (
        <form
          key={workspace.workspaceId}
          action={(formData) => startTransition(() => selectWorkspace(formData))}
        >
          <input type="hidden" name="workspaceId" value={workspace.workspaceId} />
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-md border border-border-default bg-surface-1 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-surface-2 disabled:opacity-40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{workspace.name}</span>
              <span className="text-xs capitalize text-neutral-500">{workspace.role}</span>
            </span>
          </button>
        </form>
      ))}
    </div>
  );
}
