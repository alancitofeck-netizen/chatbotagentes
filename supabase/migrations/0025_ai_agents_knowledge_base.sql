-- RAG pipeline for the "Base de conocimiento" tab (Agentes IA). Entirely
-- absent from docs/blueprint/*.md — a genuine extension beyond the
-- documented architecture, built at the user's explicit request after
-- confirming (live spike) that OpenRouter's /embeddings endpoint exists and
-- is reachable with the same auth/billing as chat completions, so no second
-- embeddings provider is needed.

create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  -- 1536 = text-embedding-3-small's dimension (OpenAI, proxied by
  -- OpenRouter) — confirmed the endpoint exists via a live spike; the exact
  -- response shape/dimension itself couldn't be double-checked because the
  -- connected OpenRouter account has zero credits (same external blocker
  -- noted earlier this session), so this is the standard, well-documented
  -- dimension for that specific model, not yet round-tripped against a real
  -- response body.
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_workspace_idx on public.document_chunks (workspace_id);

-- HNSW over IVFFlat: IVFFlat's `lists` parameter needs tuning to table size
-- and degrades on small/empty/growing tables — exactly this table's profile
-- (each workspace's knowledge base starts empty). HNSW has no such tuning
-- parameter; acceptable trade-off (heavier index builds) at the expected
-- scale (dozens-to-low-hundreds of chunks per workspace).
create index if not exists document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.document_chunks enable row level security;

create policy "document_chunks_select" on public.document_chunks
  for select using (core.is_workspace_member(workspace_id));
-- No end-user write policy — only the service-role ingestion path
-- (src/lib/ai-agents/knowledgeBase.ts) writes here.

-- Join table, NOT a reuse of documents.related_type/related_id: that column
-- pair is a single polymorphic FK (one document belongs to at most one
-- owner entity at a time), which would prevent the same document from
-- feeding more than one agent's knowledge base — an ordinary, foreseeable
-- need at 2-10 agents per workspace. related_type/related_id stays
-- untouched for its originally-intended future consumer.
create table if not exists public.agent_knowledge_base (
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  primary key (agent_id, document_id)
);

alter table public.agent_knowledge_base enable row level security;

create policy "agent_knowledge_base_select" on public.agent_knowledge_base
  for select using (
    exists (select 1 from public.ai_agents a where a.id = agent_knowledge_base.agent_id and core.is_workspace_member(a.workspace_id))
  );
create policy "agent_knowledge_base_write" on public.agent_knowledge_base
  for all
  using (
    exists (select 1 from public.ai_agents a where a.id = agent_knowledge_base.agent_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  )
  with check (
    exists (select 1 from public.ai_agents a where a.id = agent_knowledge_base.agent_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  );
