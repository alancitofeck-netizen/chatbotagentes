import type { ToolContext } from "@/lib/ai/tools/shared";

/** `search_contact` — read-only, reuses the same filter approach as
 * getContactList (src/lib/contacts/queries.ts) but self-contained against
 * the service-role client (that function is request-scoped/session-bound). */
export async function searchContact(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  const company = typeof args.company === "string" ? args.company.trim() : "";

  let query = ctx.supabase
    .from("contacts")
    .select("id, name, phone, email, company")
    .eq("workspace_id", ctx.workspaceId)
    .limit(5);

  if (name) query = query.ilike("name", `%${name}%`);
  if (phone) query = query.ilike("phone", `%${phone}%`);
  if (company) query = query.ilike("company", `%${company}%`);

  const { data } = await query;
  return { contacts: data ?? [] };
}
