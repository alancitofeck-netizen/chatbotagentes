"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Home, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { reorderGroups } from "@/lib/tasks/groups/actions";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { GROUP_COLOR_META } from "@/components/tasks/groupColorMeta";

function GroupRow({ group, active }: { group: TaskGroup; active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: group.isDefault,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="group/row flex items-center gap-1">
      {!group.isDefault && (
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Reordenar grupo"
          className="cursor-grab text-neutral-300 opacity-0 hover:text-neutral-500 focus-visible:opacity-100 group-hover/row:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>
      )}
      <Link
        href={`/tasks/groups/${group.id}`}
        className={cn(
          "flex flex-1 items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] font-medium",
          active ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
          group.isDefault && "ml-[17px]",
        )}
      >
        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded text-[11px]", GROUP_COLOR_META[group.color].bg)}>
          {group.icon}
        </span>
        <span className="truncate">{group.name}</span>
      </Link>
    </li>
  );
}

/** Sidebar bundled inside the Tasks/Workspace module — pivoted from a flat
 * quick-filters list to a Notion-style page tree: Inicio/Favoritos/Hoy/Esta
 * semana at top, then the real Grupos list (drag-reorder via @dnd-kit, same
 * pattern as ManagePipelineSheet.tsx/reorderPipelineStages), "General" (the
 * auto-provisioned catch-all, is_default) pinned last without a drag handle. */
export function TasksSidebar({ initialGroups, onNewGroup }: { initialGroups: TaskGroup[]; onNewGroup: () => void }) {
  const pathname = usePathname();
  const [groups, setGroups] = useState(initialGroups);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeGroupId = pathname.match(/^\/tasks\/groups\/([^/?]+)/)?.[1];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setGroups((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1 || prev[newIndex].isDefault) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      void reorderGroups(next.filter((g) => !g.isDefault).map((g) => g.id));
      return next;
    });
  }

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border-default bg-surface-2/60 p-4 lg:flex">
      <div className="flex flex-col gap-1">
        <h3 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Workspace</h3>
        <Link
          href="/tasks"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium",
            pathname === "/tasks" ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
          )}
        >
          <Home size={14} aria-hidden="true" />
          Inicio
        </Link>
        <Link
          href="/tasks/favorites"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium",
            pathname === "/tasks/favorites" ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
          )}
        >
          <Star size={14} aria-hidden="true" />
          Favoritos
        </Link>
        <Link
          href="/tasks/agenda?range=today"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium",
            pathname === "/tasks/agenda" ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
          )}
        >
          <CalendarDays size={14} aria-hidden="true" />
          Hoy
        </Link>
        <Link
          href="/tasks/agenda?range=week"
          className={cn(
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-3",
          )}
        >
          <CalendarDays size={14} aria-hidden="true" />
          Esta semana
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Grupos</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-0.5">
              {groups.map((g) => (
                <GroupRow key={g.id} group={g} active={activeGroupId === g.id} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={onNewGroup}
          className="mt-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-neutral-500 hover:bg-surface-3 hover:text-foreground"
        >
          <Plus size={14} aria-hidden="true" />
          Nuevo grupo
        </button>
        <Link href="/tasks/archived" className="px-2.5 py-1 text-[11px] text-neutral-400 hover:text-neutral-600 hover:underline">
          Ver archivados
        </Link>
      </div>
    </aside>
  );
}
