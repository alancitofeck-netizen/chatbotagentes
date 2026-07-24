-- Adds the two display-only fields the Owner global's cross-workspace panel
-- needs (src/lib/platform/queries.ts) that had no backing column anywhere:
-- "Estado" (activo/inactivo — no deactivation feature exists yet, this is
-- just the column so the panel has real data instead of a hardcoded value;
-- toggling it is not built here, not requested) and "Plan" (no
-- billing/subscription system exists at all yet — see
-- src/app/(protected)/profile/sections/BillingSection.tsx's own "Próximamente"
-- placeholder comment — this is a plain label column, not a real plan/tier
-- enforcement mechanism).
alter table public.workspaces
  add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));
alter table public.workspaces
  add column if not exists plan text not null default 'Free';
