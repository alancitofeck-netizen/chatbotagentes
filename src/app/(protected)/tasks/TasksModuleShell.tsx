"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { TaskGroup } from "@/lib/tasks/groups/queries";
import { GroupFormDialog } from "@/components/tasks/GroupFormDialog";
import { TemplatePickerDialog } from "@/components/tasks/TemplatePickerDialog";
import { TasksSidebar } from "./TasksSidebar";
import { NewItemMenu } from "./NewItemMenu";
import { TaskAiPanel } from "./TaskAiPanel";

/** Chrome for the whole Tasks/Workspace module: sidebar (Grupos list) + a
 * slim top bar ("Nuevo"/IA toggle) wrapping whatever page is active. Each
 * page under /tasks/* provides its own heading/content below this bar — this
 * component deliberately renders no page title of its own. */
export function TasksModuleShell({ groups, children }: { groups: TaskGroup[]; children: ReactNode }) {
  const router = useRouter();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  function handleGroupCreated(groupId: string) {
    setShowGroupForm(false);
    setShowTemplatePicker(false);
    router.push(`/tasks/groups/${groupId}`);
    router.refresh();
  }

  return (
    <div className="flex h-full">
      <TasksSidebar initialGroups={groups} onNewGroup={() => setShowGroupForm(true)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-end gap-2 border-b border-border-default px-4 py-2.5 sm:px-6 lg:px-8">
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
        {children}
      </div>

      {aiPanelOpen && <TaskAiPanel onClose={() => setAiPanelOpen(false)} />}
      {showGroupForm && <GroupFormDialog current={null} onClose={() => setShowGroupForm(false)} onSaved={handleGroupCreated} />}
      {showTemplatePicker && <TemplatePickerDialog onClose={() => setShowTemplatePicker(false)} onCreated={handleGroupCreated} />}
    </div>
  );
}
