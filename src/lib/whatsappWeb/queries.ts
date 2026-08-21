import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface WhatsAppWebSession {
  sessionId: string;
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  status: "connecting" | "qr_pending" | "connected" | "disconnected" | "logged_out" | "auth_failed";
  phoneE164: string | null;
  deviceName: string | null;
  qrData: string | null;
  qrExpiresAt: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  /** Mensaje real de WhatsApp cuando status='auth_failed' (ver
   * 0159_whatsapp_web_auth_failed_status.sql) — null en cualquier otro
   * estado salvo que también se use como motivo genérico de desconexión. */
  disconnectReason: string | null;
}

/** RLS on `whatsapp_web_sessions` (0050_whatsapp_web_sessions.sql) already
 * scopes this correctly per caller: a plain Agent only ever gets their own
 * row back, Owner/Admin get every row in the workspace — no extra filtering
 * needed here. Names/avatars/roles resolved the same way
 * `getWorkspaceMembersList` (src/lib/settings/queries.ts) already does. */
export async function getWhatsAppWebSessions(workspaceId: string): Promise<WhatsAppWebSession[]> {
  const supabase = await createClient();

  const [{ data: sessions }, { data: names }, { data: members }] = await Promise.all([
    supabase
      .from("whatsapp_web_sessions")
      .select("id, member_id, status, phone_e164, device_name, qr_data, qr_expires_at, last_connected_at, last_disconnected_at, disconnect_reason")
      .eq("workspace_id", workspaceId),
    supabase.rpc("workspace_member_names", { ws_id: workspaceId }),
    supabase.from("workspace_members").select("id, role").eq("workspace_id", workspaceId),
  ]);

  const nameByMember = new Map<string, { fullName: string; avatarUrl: string | null }>(
    (names ?? []).map((n: { member_id: string; full_name: string; avatar_url: string | null }) => [
      n.member_id,
      { fullName: n.full_name, avatarUrl: n.avatar_url },
    ]),
  );
  const roleByMember = new Map((members ?? []).map((m) => [m.id as string, m.role as string]));

  return (sessions ?? []).map((s) => ({
    sessionId: s.id as string,
    memberId: s.member_id as string,
    fullName: nameByMember.get(s.member_id as string)?.fullName ?? "—",
    avatarUrl: nameByMember.get(s.member_id as string)?.avatarUrl ?? null,
    role: roleByMember.get(s.member_id as string) ?? "agent",
    status: s.status as WhatsAppWebSession["status"],
    phoneE164: s.phone_e164 as string | null,
    deviceName: s.device_name as string | null,
    qrData: s.qr_data as string | null,
    qrExpiresAt: s.qr_expires_at as string | null,
    lastConnectedAt: s.last_connected_at as string | null,
    lastDisconnectedAt: s.last_disconnected_at as string | null,
    disconnectReason: s.disconnect_reason as string | null,
  }));
}
