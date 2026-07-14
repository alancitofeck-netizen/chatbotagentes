-- Fixes a real gap the Supabase advisor caught right after 0020/0021 were
-- applied: `revoke all on function ... from public;` alone did NOT block
-- `anon`/`authenticated` from calling these via PostgREST RPC — unlike the
-- established 0012/0013 pattern (get_whatsapp_credentials explicitly revokes
-- from public, anon, AND authenticated separately). Checked directly via
-- information_schema.routine_privileges: push_conversation_buffer_message,
-- claim_pending_conversation_buffers, clear_processed_buffer_messages, and
-- upsert_openrouter_integration all still had EXECUTE granted straight to
-- anon/authenticated after the single "revoke from public" — apparently this
-- project's default-privilege grants for new public-schema functions changed
-- at some point in its history (older functions like upsert_whatsapp_integration
-- don't have this problem), so the single-revoke pattern is no longer
-- sufficient and every future function needs the explicit triple revoke.
--
-- Severity: real, not cosmetic — the three conversation_buffers functions
-- have NO internal auth check at all (by design, they're meant to be
-- service_role-only backend plumbing), so anon being able to call
-- claim_pending_conversation_buffers directly would let an unauthenticated
-- caller claim/process ANY workspace's buffered messages.

revoke all on function public.push_conversation_buffer_message(uuid, uuid, uuid, int) from anon;
revoke all on function public.push_conversation_buffer_message(uuid, uuid, uuid, int) from authenticated;

revoke all on function public.claim_pending_conversation_buffers(int) from anon;
revoke all on function public.claim_pending_conversation_buffers(int) from authenticated;

revoke all on function public.clear_processed_buffer_messages(uuid, uuid[]) from anon;
revoke all on function public.clear_processed_buffer_messages(uuid, uuid[]) from authenticated;

-- upsert/disconnect_openrouter_integration: `authenticated` access is
-- intentional (mirrors upsert_whatsapp_integration) — only `anon` needs
-- revoking here.
revoke all on function public.upsert_openrouter_integration(uuid, text, text) from anon;
revoke all on function public.disconnect_openrouter_integration(uuid) from anon;
