-- Per-agent read-tracking for the Inbox redesign's "No leídas" tab and
-- unread-count badges. Nothing today tracks who saw which conversation when
-- (confirmed: no unread/read_at concept anywhere in 02-database.md) — this is
-- a deliberate, explicitly-requested real feature (not a UI heuristic), so a
-- small additive table is justified rather than guessing "unread" from
-- message direction alone.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, member_id)
);

create index conversation_reads_member_idx on public.conversation_reads (member_id, workspace_id);

alter table public.conversation_reads enable row level security;

create policy "conversation_reads_select" on public.conversation_reads
  for select using (core.is_workspace_member(workspace_id));

-- An agent may only write their OWN read-state row — member_id must resolve
-- back to their own auth.uid(), so nobody can mark a conversation "read" on
-- behalf of a teammate.
create policy "conversation_reads_insert_own" on public.conversation_reads
  for insert with check (
    core.is_workspace_member(workspace_id)
    and member_id in (select id from public.workspace_members where user_id = auth.uid())
  );

create policy "conversation_reads_update_own" on public.conversation_reads
  for update
  using (member_id in (select id from public.workspace_members where user_id = auth.uid()))
  with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));
