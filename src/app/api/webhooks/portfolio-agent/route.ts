import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { findOrCreateContact } from "@/lib/contacts/match";
import { logActivity } from "@/lib/activity/log";

/**
 * Receives progress/results from `worker/portfolio-agent/` — same pattern
 * as `/api/webhooks/whatsapp-web`: shared bearer secret compared with
 * `timingSafeEqual`, idempotency via the existing `webhook_events` table
 * (provider: "portfolio_agent"), and never trusting a given
 * connectionId/workspaceId pair without checking it in the DB first.
 *
 * This route (not the worker) does all the real business-logic writes:
 * contact matching (`findOrCreateContact`, extended for dni/cuit), upsert
 * into `policies`, and updating `insurance_sync_jobs`/`insurance_connections`.
 * The worker never touches `policies`/`contacts` directly.
 */
function verifySharedSecret(request: NextRequest): boolean {
  const expected = process.env.PORTFOLIO_WORKER_WEBHOOK_SECRET;
  if (!expected) {
    console.error("[portfolio-agent-webhook] PORTFOLIO_WORKER_WEBHOOK_SECRET is not configured — rejecting all requests.");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

interface PortalPolicyRawPayload {
  externalId: string;
  policyNumber: string | null;
  clientName: string | null;
  clientDocument: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  product: string | null;
  policyType: string | null;
  premium: number | null;
  premiumCurrency: string | null;
  paymentFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  status: string | null;
}

interface PortfolioAgentWebhookPayload {
  eventId?: string;
  jobId: string;
  workspaceId: string;
  connectionId: string;
  type: "progress" | "policy_extracted" | "completed" | "failed" | "cancelled" | "requires_user_action";
  progress?: { step: string; processed: number; total: number | null };
  policy?: PortalPolicyRawPayload;
  processedCount?: number;
  error?: string;
  reason?: string;
}

/** El texto de estado que muestra el portal es libre y varía por
 * aseguradora — nunca se inventa un mapeo fino acá. Solo se detectan las
 * dos señales inequívocas (cancelada/vencida); cualquier otra cosa entra
 * como 'activa', que es lo correcto para una póliza que el portal está
 * listando como parte de la cartera vigente. */
function mapPolicyStatus(rawStatus: string | null): string {
  const normalized = (rawStatus ?? "").toLowerCase();
  if (normalized.includes("cancel")) return "cancelada";
  if (normalized.includes("venc")) return "vencida";
  return "activa";
}

export async function POST(request: NextRequest) {
  if (!verifySharedSecret(request)) {
    console.warn("[portfolio-agent-webhook] shared secret verification failed, rejecting");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: PortfolioAgentWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.jobId || !payload.workspaceId || !payload.connectionId || !payload.type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (payload.eventId) {
    const { error: webhookEventError } = await supabase
      .from("webhook_events")
      .insert({ provider: "portfolio_agent", event_id: payload.eventId, event_type: payload.type, payload: payload as unknown as object });
    if (webhookEventError) {
      if (webhookEventError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      console.error("[portfolio-agent-webhook] failed to record webhook_events row:", webhookEventError);
    }
  }

  // Nunca confiar en connectionId/workspaceId sin verificar, aunque venga
  // por el canal autenticado — mismo criterio que el webhook de WhatsApp Web.
  const { data: connection } = await supabase
    .from("insurance_connections")
    .select("id, provider_id, connected_at, insurance_providers(name)")
    .eq("id", payload.connectionId)
    .eq("workspace_id", payload.workspaceId)
    .maybeSingle();
  if (!connection) {
    console.error(`[portfolio-agent-webhook] connectionId ${payload.connectionId} does not belong to workspace ${payload.workspaceId} — dropping.`);
    return NextResponse.json({ error: "unknown_connection" }, { status: 404 });
  }
  const providerRow = Array.isArray(connection.insurance_providers) ? connection.insurance_providers[0] : connection.insurance_providers;
  const providerName = (providerRow as { name: string } | undefined)?.name ?? "Aseguradora";

  switch (payload.type) {
    case "progress": {
      if (payload.progress) {
        await supabase
          .from("insurance_sync_jobs")
          .update({ status: payload.progress.step, current_step: payload.progress.step, processed_count: payload.progress.processed, total_count: payload.progress.total })
          .eq("id", payload.jobId);
      }
      break;
    }

    case "policy_extracted": {
      if (payload.policy) {
        const p = payload.policy;
        const contactId = await findOrCreateContact(
          supabase,
          payload.workspaceId,
          { name: p.clientName ?? undefined, phone: p.clientPhone ?? undefined, email: p.clientEmail ?? undefined, dni: p.clientDocument ?? undefined },
          "portal_sync",
        );

        const { error: upsertError } = await supabase
          .from("policies")
          .upsert(
            {
              workspace_id: payload.workspaceId,
              contact_id: contactId,
              insurance_connection_id: payload.connectionId,
              external_id: p.externalId,
              policy_number: p.policyNumber,
              company: providerName,
              product: p.product,
              status: mapPolicyStatus(p.status),
              start_date: p.startDate,
              end_date: p.endDate,
              renewal_date: p.renewalDate,
              premium: p.premium,
              premium_currency: p.premiumCurrency ?? "USD",
              payment_frequency: p.paymentFrequency,
              source: "portal_sync",
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: "insurance_connection_id,external_id" },
          );
        if (upsertError) {
          console.error(`[portfolio-agent-webhook] failed to upsert policy ${p.externalId}:`, upsertError);
        }
      }
      break;
    }

    case "completed": {
      const now = new Date().toISOString();
      const { data: distinctContacts } = await supabase.from("policies").select("contact_id").eq("insurance_connection_id", payload.connectionId);
      const clientsSyncedCount = new Set(((distinctContacts ?? []) as { contact_id: string }[]).map((r) => r.contact_id)).size;

      await supabase
        .from("insurance_sync_jobs")
        .update({ status: "completed", processed_count: payload.processedCount ?? null, policies_synced_count: payload.processedCount ?? 0, clients_synced_count: clientsSyncedCount, completed_at: now })
        .eq("id", payload.jobId);
      await supabase
        .from("insurance_connections")
        .update({ status: "connected", connected_at: connection.connected_at ?? now, last_sync_at: now, last_error: null })
        .eq("id", payload.connectionId);
      await logActivity(supabase, payload.workspaceId, null, "insurance_connection", payload.connectionId, "insurance_connection_synced", {
        provider: providerName,
        method: "portal",
        processedCount: payload.processedCount ?? 0,
      });
      break;
    }

    case "cancelled": {
      await supabase
        .from("insurance_sync_jobs")
        .update({ status: "cancelled", processed_count: payload.processedCount ?? null, completed_at: new Date().toISOString() })
        .eq("id", payload.jobId);
      break;
    }

    case "failed": {
      const now = new Date().toISOString();
      await supabase.from("insurance_sync_jobs").update({ status: "failed", error: payload.error ?? "Error desconocido.", completed_at: now }).eq("id", payload.jobId);
      await supabase.from("insurance_connections").update({ status: "error", last_error: payload.error ?? "Error desconocido." }).eq("id", payload.connectionId);
      break;
    }

    case "requires_user_action": {
      await supabase
        .from("insurance_sync_jobs")
        .update({ status: "requires_user_action", error: payload.reason ?? null, completed_at: new Date().toISOString() })
        .eq("id", payload.jobId);
      await supabase.from("insurance_connections").update({ status: "error", last_error: payload.reason ?? "Requiere intervención manual." }).eq("id", payload.connectionId);
      break;
    }
  }

  if (payload.eventId) {
    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "portfolio_agent")
      .eq("event_id", payload.eventId);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
