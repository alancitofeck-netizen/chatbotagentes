-- Métricas tab (Agentes IA) needs "conversaciones atendidas" (distinct
-- count) and "tiempo promedio de respuesta" — usage_events had neither a
-- conversation reference nor a latency figure. Deliberately NOT adding
-- agent_id to `messages` for this (bigger, riskier change to the hot send
-- path) — these two nullable, additive columns on the already-agent-tagged
-- usage_events are enough.
alter table public.usage_events add column if not exists conversation_id uuid references public.conversations (id) on delete set null;
alter table public.usage_events add column if not exists latency_ms int;

create index if not exists usage_events_conversation_idx on public.usage_events (conversation_id);
