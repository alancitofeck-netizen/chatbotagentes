-- Custom Resend-based OTP system — replaces Supabase Auth's own built-in
-- signup-confirmation email/link entirely (see src/app/(auth)/register/
-- actions.ts and src/lib/email/otp-service.ts) and is reused for password
-- recovery too (src/app/(auth)/forgot-password/actions.ts). Codes are never
-- stored in plaintext — only a SHA-256 hash keyed to (code, email, purpose)
-- so a leaked hash can't be replayed against a different email/purpose.

create table if not exists public.email_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('signup', 'password_reset')),
  user_id uuid references auth.users (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  -- Password-reset only: once the code itself is verified, a second,
  -- longer-lived random token is minted and handed to the browser as an
  -- httpOnly cookie (src/lib/auth/reset-token.ts) so the "set new password"
  -- step doesn't require re-entering the code, without ever establishing a
  -- real Supabase session for a flow that's otherwise unauthenticated.
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  reset_token_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_otp_codes_lookup_idx
  on public.email_otp_codes (email, purpose, created_at desc);

alter table public.email_otp_codes enable row level security;
-- Deliberately no policies at all — this table holds security-sensitive
-- hashes/attempt counters and is only ever read/written by
-- src/lib/email/otp-service.ts via the service-role client
-- (src/lib/supabase/service-role.ts). A normal anon/authenticated session
-- must always see zero rows here.

-- auth.users isn't exposed to PostgREST under any role (schema-exposure,
-- not RLS), so resolving "does this email already have an account" for the
-- forgot-password flow needs a SECURITY DEFINER function that reaches into
-- auth.users on the caller's behalf, same pattern as core.is_platform_admin()
-- (0039_role_permissions_system.sql).
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
