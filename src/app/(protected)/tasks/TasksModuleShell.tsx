"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, PanelLeft } from "lucide-react";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { GroupFormDialog } from "@/components/tasks/GroupFormDialog";
import { TemplatePickerDialog } from "@/components/tasks/TemplatePickerDialog";
import { TasksSidebar } from "./TasksSidebar";
import { NewItemMenu } from "./NewItemMenu";
import { TaskAiPanel } from "./TaskAiPanel";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

/** Chrome for the whole Tasks/Workspace module: sidebar (Grupos list) + a
 * slim top bar ("Nuevo"/IA toggle) wrapping whatever page is active. Each
 * page under /tasks/* provides its own heading/content below this bar — this
 * component deliberately renders no page title of its own. */
export function TasksModuleShell({
  groups,
  children,
}: {
  groups: TaskGroup[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useAutoStartTour("tasks-create-task");

  function handleGroupCreated(groupId: string) {
    setShowGroupForm(false);
    setShowTemplatePicker(false);
    router.push(`/tasks/groups/${groupId}`);
    router.refresh();
  }

  return (
    <div className="flex h-full">
      <TasksSidebar
        initialGroups={groups}
        onNewGroup={() => setShowGroupForm(true)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between gap-2 border-b border-border-default px-4 py-2.5 sm:px-6 lg:justify-end lg:px-8">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            title="Grupos"
            aria-label="Abrir grupos de tareas"
            className="flex size-9 items-center justify-center rounded-md border border-border-strong text-neutral-500 hover:bg-surface-2 hover:text-foreground lg:hidden"
          >
            <PanelLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <ModuleHelp description="Las tareas te ayudan a saber qué tenés que hacer y cuándo. Organizalas en grupos y asignaselas a vos o a tu equipo." tourKey="tasks-create-task" />
            <NewItemMenu onNewGroup={() => setShowGroupForm(true)} onNewTemplate={() => setShowTemplatePicker(true)} />
            <button
              type="button"
              onClick={() => setAiPanelOpen((v) => !v)}
              title="Asistente IA"
              className="flex size-9 items-center justify-center rounded-md border border-border-strong text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <Sparkles size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        {children}
      </div>

      {aiPanelOpen && <TaskAiPanel onClose={() => setAiPanelOpen(false)} />}
      {showGroupForm && (
        <GroupFormDialog current={null} onClose={() => setShowGroupForm(false)} onSaved={handleGroupCreated} />
      )}
      {showTemplatePicker && <TemplatePickerDialog onClose={() => setShowTemplatePicker(false)} onCreated={handleGroupCreated} />}
    </div>
  );
}
