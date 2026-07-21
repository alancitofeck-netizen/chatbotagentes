import { createClient } from "@/lib/supabase/server";

export interface WhatsAppTemplate {
  id: string;
  ycloudTemplateId: string;
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  bodyText: string;
  createdAt: string;
}

/** Local mirror of YCloud's template state (whatsapp_templates,
 * 0032_whatsapp_templates.sql) — source of truth for the Plantillas list UI,
 * kept in sync by createTemplate/deleteTemplate (src/lib/templates/actions.ts)
 * and the whatsapp.template.reviewed webhook. */
export async function getTemplateList(workspaceId: string): Promise<WhatsAppTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("id, ycloud_template_id, name, language, category, status, rejection_reason, components, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const components = (row.components ?? []) as Array<{ type: string; text?: string }>;
    const body = components.find((c) => c.type === "BODY");
    return {
      id: row.id as string,
      ycloudTemplateId: row.ycloud_template_id as string,
      name: row.name as string,
      language: row.language as string,
      category: row.category as WhatsAppTemplate["category"],
      status: row.status as WhatsAppTemplate["status"],
      rejectionReason: row.rejection_reason as string | null,
      bodyText: body?.text ?? "",
      createdAt: row.created_at as string,
    };
  });
}
