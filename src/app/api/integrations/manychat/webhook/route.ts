import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processManychatEvent, type ManychatWebhookPayload } from "@/lib/integrations/manychat";

/**
 * Receptor pasivo de eventos de ManyChat — GrowthLink solo guarda, nunca
 * responde ni controla el flujo. A diferencia de YCloud/WhatsApp Web/
 * Instagram (secreto único global, o resuelto por sesión/cuenta ya
 * conocida), acá el secreto es POR WORKSPACE (integration_connections.
 * webhook_secret, provider='manychat') — es el propio usuario quien pega
 * la URL + el secreto en un paso "External Request" de su flujo de
 * ManyChat, así que el secreto ES la forma de resolver a qué workspace
 * pertenece el evento, no algo que se revalida contra otro dato.
 *
 * El body es deliberadamente flexible — "External Request" de ManyChat es
 * un paso de flujo que el propio usuario arma a mano con sus variables, no
 * un webhook con un contrato fijo. Solo `manychat_contact_id` es
 * obligatorio; todo lo demás se guarda si viene, se ignora si no.
 */
async function resolveWorkspaceIdBySecret(supabase: ReturnType<typeof createServiceRoleClient>, secret: string): Promise<string | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("workspace_id")
    .eq("provider", "manychat")
    .eq("webhook_secret", secret)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

function stableEventId(workspaceId: string, payload: ManychatWebhookPayload): string {
  // ManyChat no manda un id de evento propio — se deriva uno estable del
  // contenido real, así un reenvío exacto del mismo payload no duplica
  // nada (webhook_events ya es único por (provider, event_id)).
  const basis = JSON.stringify({
    workspaceId,
    manychatContactId: payload.manychat_contact_id,
    message: payload.message ?? null,
    customFields: payload.custom_fields ?? null,
  });
  return createHash("sha256").update(basis).digest("hex");
}

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const workspaceId = await resolveWorkspaceIdBySecret(supabase, secret);
  if (!workspaceId) {
    console.warn("[manychat-webhook] no workspace matches the provided secret — rejecting.");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: ManychatWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.manychat_contact_id) {
    return NextResponse.json({ error: "missing_manychat_contact_id" }, { status: 400 });
  }

  const eventId = stableEventId(workspaceId, payload);
  const { error: webhookEventError } = await supabase
    .from("webhook_events")
    .insert({ provider: "manychat", event_id: eventId, event_type: "manychat_event", payload: payload as unknown as object });
  if (webhookEventError) {
    if (webhookEventError.code === "23505") {
      console.log(`[manychat-webhook] event ${eventId} already processed, skipping duplicate.`);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
    console.error("[manychat-webhook] failed to record webhook_events row:", webhookEventError);
  }

  try {
    const { contactId } = await processManychatEvent(supabase, workspaceId, payload);
    await supabase.from("webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider", "manychat").eq("event_id", eventId);
    return NextResponse.json({ received: true, contactId }, { status: 200 });
  } catch (err) {
    console.error("[manychat-webhook] failed to process event:", err);
    await supabase
      .from("webhook_events")
      .update({ status: "failed", last_error: err instanceof Error ? err.message : "unknown_error" })
      .eq("provider", "manychat")
      .eq("event_id", eventId);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
