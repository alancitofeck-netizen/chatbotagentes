-- Cosine-similarity search over document_chunks, scoped to one agent's
-- "ready" knowledge base. pgvector's `<=>` operator isn't expressible via
-- the supabase-js query builder, so this needs a SQL function — called only
-- from Agent Runtime's service-role client (agentRuntime.ts::buildContext),
-- never from the browser, so it's locked to service_role only, same
-- posture as the buffer-management functions in 0020.
-- Note: `set search_path = ''` (this codebase's default for every
-- SECURITY-sensitive function) breaks pgvector's `<=>` operator resolution —
-- an empty search_path means operators must be schema-qualified via
-- `OPERATOR(schema.op)`, confirmed by a real ERROR 42883 when this was first
-- written without it. `vector` (and its operators) live in `public` since
-- `create extension vector` (0025) didn't specify a schema.
create or replace function public.match_agent_knowledge_chunks(
  p_agent_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (document_id uuid, content text, similarity float)
language sql
stable
set search_path = ''
as $$
  select dc.document_id, dc.content, 1 - (dc.embedding OPERATOR(public.<=>) p_query_embedding) as similarity
  from public.document_chunks dc
  join public.agent_knowledge_base akb on akb.document_id = dc.document_id
  where akb.agent_id = p_agent_id and akb.status = 'ready'
  order by dc.embedding OPERATOR(public.<=>) p_query_embedding
  limit p_match_count;
$$;

revoke all on function public.match_agent_knowledge_chunks(uuid, vector, int) from public;
revoke all on function public.match_agent_knowledge_chunks(uuid, vector, int) from anon;
revoke all on function public.match_agent_knowledge_chunks(uuid, vector, int) from authenticated;
grant execute on function public.match_agent_knowledge_chunks(uuid, vector, int) to service_role;
