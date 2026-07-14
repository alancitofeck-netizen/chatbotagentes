import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";

/** `create_opportunity` — side-effecting. Lighter-weight than the
 * session-bound `createOpportunity` Server Action (src/lib/crm/actions.ts):
 * that one also upserts a brand-new contact from a lead form. Here the
 * contact already exists (it's the WhatsApp contact of the current
 * conversation) — this just needs the pipeline/stage + opportunity/
 * pipeline_items writes, run against the service-role client since there's
 * no signed-in user in this codepath. */
export async function createOpportunity(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const contactId = String(args.contact_id ?? "");
  const title = String(args.title ?? "").trim();
  const value = typeof args.value === "number" ? args.value : 0;
  const currency = typeof args.currency === "string" && args.currency.trim() ? args.currency.trim() : "USD";

  if (!title) throw new Error("title is required");

  const { data: contact } = await ctx.supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!contact) throw crossTenantRejection("contact_id");

  const { data: pipeline } = await ctx.supabase
    .from("pipelines")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("module_key", "crm")
    .limit(1)
    .maybeSingle();
  if (!pipeline) throw new Error("no_crm_pipeline");

  const { data: firstStage } = await ctx.supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStage) throw new Error("no_pipeline_stages");

  const { data: opportunity, error: opportunityError } = await ctx.supabase
    .from("opportunities")
    .insert({ workspace_id: ctx.workspaceId, contact_id: contactId, title, value, currency })
    .select("id")
    .single();
  if (opportunityError || !opportunity) throw new Error("create_opportunity_failed");

  const { data: pipelineItem, error: pipelineItemError } = await ctx.supabase
    .from("pipeline_items")
    .insert({
      pipeline_id: pipeline.id,
      stage_id: firstStage.id,
      item_type: "opportunity",
      item_id: opportunity.id,
      position: 0,
    })
    .select("id")
    .single();
  if (pipelineItemError || !pipelineItem) throw new Error("create_pipeline_item_failed");

  await ctx.supabase.from("opportunities").update({ pipeline_item_id: pipelineItem.id }).eq("id", opportunity.id);

  return { opportunityId: opportunity.id };
}
