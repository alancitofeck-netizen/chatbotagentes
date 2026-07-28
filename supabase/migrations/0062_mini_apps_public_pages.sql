-- Mini Apps module (Phase 2): visit tracking for Growth-Link-hosted public
-- pages + a Storage bucket for per-mini-app logos. mini_apps.branding/
-- config (jsonb, added in 0061) need no new columns for this phase.

create table public.mini_app_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index mini_app_visits_mini_app_idx on public.mini_app_visits (mini_app_id, created_at desc);

alter table public.mini_app_visits enable row level security;

create policy "mini_app_visits_select" on public.mini_app_visits
  for select using (core.is_workspace_member(workspace_id));

-- Deliberately no insert policy for authenticated/anon — the only writer is
-- the public /visit tracking endpoint, which always uses
-- createServiceRoleClient() (bypasses RLS), same reasoning as
-- mini_app_leads/webhook_events.

-- Public bucket for mini-app logos, same shape as avatars (0049_user_avatars.sql).
insert into storage.buckets (id, name, public)
values ('mini-app-logos', 'mini-app-logos', true)
on conflict (id) do nothing;

-- Even a public bucket needs its own SELECT policy — the Storage API's
-- upload endpoint issues its INSERT with a RETURNING clause, which fails
-- RLS without a matching SELECT policy even though the bucket is public
-- and the INSERT policy's own WITH CHECK passes independently (same gotcha
-- documented in 0049_user_avatars.sql).
create policy "mini_app_logos_storage_select" on storage.objects
  for select using (bucket_id = 'mini-app-logos');

-- Path convention: {mini_app_id}/logo.webp — ownership is scoped by joining
-- back to mini_apps.workspace_id (unlike avatars, which match auth.uid()
-- directly, a mini app's logo belongs to a workspace, not a single user).
create policy "mini_app_logos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'mini-app-logos'
    and exists (
      select 1 from public.mini_apps ma
      where ma.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(ma.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "mini_app_logos_storage_update" on storage.objects
  for update using (
    bucket_id = 'mini-app-logos'
    and exists (
      select 1 from public.mini_apps ma
      where ma.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(ma.workspace_id, array['owner', 'admin', 'agent'])
    )
  );

create policy "mini_app_logos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'mini-app-logos'
    and exists (
      select 1 from public.mini_apps ma
      where ma.id::text = (storage.foldername(name))[1]
        and core.has_workspace_role(ma.workspace_id, array['owner', 'admin', 'agent'])
    )
  );
