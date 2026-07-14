import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processClaimedBuffer, type ConversationBufferRow } from "@/lib/ai/bufferDispatch";

export const maxDuration = 60;

/**
 * Buffer Inteligente flush entrypoint. Primary trigger since 2026-07-14 is
 * pg_cron + pg_net inside Supabase (`supabase/migrations/
 * 0029_pgcron_buffer_flush.sql`, every 15s — matches docs/blueprint/
 * 04-inbox.md's original "Diseño A" design), because Vercel's Hobby plan
 * only allows Cron Jobs to run once a day, which would make the flush
 * effectively once-daily if Vercel Cron stayed the only trigger. `vercel.json`
 * still calls this same route, now only as a once-a-day safety net (Hobby-
 * compatible) in case pg_net ever fails to reach it. `processClaimedBuffer`
 * doesn't care which trigger fired it — both send the exact same request.
 *
 * Auth: pg_net sends `Authorization: Bearer <secret>` reading the secret from
 * Supabase Vault (never stored in the migration file itself). Vercel's own
 * Cron trigger sends the same header automatically from the `CRON_SECRET`
 * env var — both must hold the same value for either trigger to work.
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
