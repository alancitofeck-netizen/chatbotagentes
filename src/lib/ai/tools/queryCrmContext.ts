import type { ToolContext } from "@/lib/ai/tools/shared";
import { crossTenantRejection } from "@/lib/ai/tools/shared";

/** `query_crm_context` — read-only. Returns the contact's most recent
 * opportunity + current pipeline stage, if any. */
export async function queryCrmContext(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const contactId = String(args.contact_id ?? "");

  const { data: contact } = await ctx.supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!contact) throw crossTenantRejection("contact_id");

  const { data: opportunity } = await ctx.supabase
    .from("opportunities")
    .select("id, title, value, currency, status, pipeline_item_id, pipeline_items(stage_id, pipeline_stages(name))")
    .eq("workspace_id", ctx.workspaceId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!opportunity) return { opportunity: null };

  const pipelineItem = Array.isArray(opportunity.pipeline_items) ? opportunity.pipeline_items[0] : opportunity.pipeline_items;
  const stage = pipelineItem
    ? Array.isArray(pipelineItem.pipeline_stages)
      ? pipelineItem.pipeline_stages[0]
      : pipelineItem.pipeline_stages
    : null;

  return {
    opportunity: {
      id: opportunity.id,
      title: opportunity.title,
      value: opportunity.value,
      currency: opportunity.currency,
      status: opportunity.status,
      stageName: stage?.name ?? null,
    },
  };
}
