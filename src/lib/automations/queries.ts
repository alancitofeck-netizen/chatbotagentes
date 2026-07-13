import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AutomationListItem {
  id: string;
  name: string;
  enabled: boolean;
  triggerKeyword: string | null;
  actionBody: string | null;
  createdAt: string;
}

interface TriggerShape {
  type?: string;
  keyword?: string;
}
interface ActionShape {
  type?: string;
  body?: string;
}

/** Only the "keyword trigger / send_text action" shape is read/written by this
 * UI (docs/blueprint/13-agent-engine.md's sole concrete example) — trigger/
 * actions are jsonb so the schema tolerates other shapes without a migration,
 * but nothing here interprets them yet. `conditions` isn't surfaced at all
 * (Blueprint doesn't define its vocabulary). */
export async function getAutomationList(workspaceId: string): Promise<AutomationListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("id, name, enabled, trigger, actions, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const trigger = (row.trigger ?? {}) as TriggerShape;
    const actions = (row.actions ?? []) as ActionShape[];
    return {
      id: row.id as string,
      name: row.name as string,
      enabled: row.enabled as boolean,
      triggerKeyword: trigger.keyword ?? null,
      actionBody: actions[0]?.body ?? null,
      createdAt: row.created_at as string,
    };
  });
}
