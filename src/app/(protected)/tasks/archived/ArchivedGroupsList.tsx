"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { unarchiveGroup } from "@/lib/tasks/groups/actions";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { GROUP_COLOR_META } from "@/components/tasks/groupColorMeta";

export function ArchivedGroupsList({ initialGroups }: { initialGroups: TaskGroup[] }) {
  const [groups, setGroups] = useState(initialGroups);
  const [isPending, startTransition] = useTransition();

  /** Optimistic — same reasoning as GroupDetailShell's handleToggleComplete:
   * unarchiveGroup's revalidatePath("/tasks") (refreshes the sidebar's
   * Grupos list from layout.tsx) can supersede this transition before its
   * own setState runs, leaving the row stuck here until a reload even
   * though the DB write succeeds. Update the list first, mutate after. */
  function handleUnarchive(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    startTransition(async () => {
      try {
        await unarchiveGroup(groupId);
        toast.success("Grupo restaurado.");
      } catch {
        toast.error("No se pudo restaurar el grupo.");
      }
    });
  }

  if (groups.length === 0) {
    return <EmptyState icon={Archive} title="Sin grupos archivados" description="Los grupos que archives desde su propia página aparecen acá." />;
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.id} className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 p-3">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[15px] ${GROUP_COLOR_META[group.color].bg}`}>
            {group.icon}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-foreground">{group.name}</span>
          <button
            type="button"
            onClick={() => handleUnarchive(group.id)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-40"
          >
            <ArchiveRestore size={13} aria-hidden="true" />
            Desarchivar
          </button>
        </li>
      ))}
    </ul>
  );
}
