import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processClaimedBuffer, type ConversationBufferRow } from "@/lib/ai/bufferDispatch";

export const maxDuration = 60;

/**
 * Buffer Inteligente flush — Vercel Cron entrypoint (Diseño B del plan del
 * Motor de IA). pg_cron/pg_net availability on this Supabase project was
 * unconfirmed (MCP tooling was down during this build), so this pass ships
 * the zero-new-extension fallback: Vercel Cron (`vercel.json`, 1-minute
 * floor — no sub-minute tier exists on Vercel at any plan) calls this route,
 * which claims + processes buffers in the same invocation. Worst-case
 * first-reply latency is the buffer window (8-15s) + up to ~60s cron
 * latency, not the spec's 3-5s target — a real UX trade-off, flagged, not
 * silent. If pg_cron+pg_net are ever confirmed available, this route stays
 * as-is; only the trigger mechanism changes (pg_net calling an equivalent
 * internal endpoint), since `processClaimedBuffer` is the single shared
 * entry point either design calls.
 *
 * Auth: Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to
 * its own Cron-triggered requests when a `CRON_SECRET` env var is set —
 * standard Vercel Cron protection, no custom header scheme invented here.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: claimed, error } = await supabase.rpc("claim_pending_conversation_buffers", { p_limit: 10 });
  if (error) {
    console.error("[cron/flush-buffers] failed to claim buffers:", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const rows = (claimed ?? []) as ConversationBufferRow[];
  await Promise.allSettled(rows.map((row) => processClaimedBuffer(row)));

  return NextResponse.json({ processed: rows.length }, { status: 200 });
}
