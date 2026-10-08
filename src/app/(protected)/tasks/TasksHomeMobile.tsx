"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FolderPlus, LayoutTemplate, ListTodo, Plus, Sparkles } from "lucide-react";
import { FabMenu } from "@/components/ui/FabMenu";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import type { TaskOption } from "@/lib/tasks/queries";
import { useTasksShell } from "./TasksShellContext";

/** Volver a la pantalla anterior; si se entró directo a /tasks, al inicio. */
export function TasksHomeBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/dashboard"))}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-1 text-foreground"
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
    </button>
  );
}

/** Acciones del inicio de Tareas en mobile (la barra superior del módulo no se
 * muestra ahí): "Nueva tarea", "Sugerencias IA" y el FAB, que además ofrece
 * crear un grupo o una plantilla — y es donde apunta el tour guiado de Tareas en
 * mobile (data-tour "tasks.new-menu-trigger" / "tasks.new-group-item", los mismos
 * que usa NewItemMenu en la barra de escritorio). */
export function TasksHomeActions({
  ownMemberId,
  members,
  contactOptions,
  conversationOptions,
  canAssignOthers,
}: {
  ownMemberId: string | null;
  members: { memberId: string; fullName: string }[];
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const shell = useTasksShell();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-semibold text-white shadow-[var(--elevation-sm)] hover:bg-accent-600"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva tarea
        </button>
        <button
          type="button"
          onClick={shell.openAiPanel}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-4 text-sm font-semibold text-foreground hover:bg-surface-2"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Sugerencias IA
        </button>
      </div>

      <FabMenu
        title="Crear"
        tourId="tasks.new-menu-trigger"
        actions={[
          { label: "Nueva tarea", icon: <ListTodo className="size-4" aria-hidden="true" />, onSelect: () => setCreating(true) },
          { label: "Nuevo grupo de tareas", icon: <FolderPlus className="size-4" aria-hidden="true" />, onSelect: shell.openNewGroup, tourId: "tasks.new-group-item" },
          { label: "Nueva plantilla", icon: <LayoutTemplate className="size-4" aria-hidden="true" />, onSelect: shell.openNewTemplate },
        ]}
      />

      {creating && (
        <TaskFormSheet
          current={null}
          members={members}
          contactOptions={contactOptions}
          conversationOptions={conversationOptions}
          canAssignOthers={canAssignOthers}
          ownMemberId={ownMemberId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
