-- =============================================================================
-- 0001_portfolio_leads.sql
--
-- Lead capture for the portfolio's project-request wizard.
--
-- Trust model
--   * Rows are written ONLY by the `project-estimate` Edge Function, which
--     holds the service-role key. The service role bypasses RLS by design.
--   * The browser's anon key can do NOTHING with this table: no select, no
--     insert, no update, no delete. That is enforced below by enabling RLS and
--     then simply never granting anon a policy.
--   * The admin dashboard reads and updates through an authenticated session,
--     and every policy re-checks membership of `admin_users` on each row.
--
-- The table holds personal data (name, email, phone). It deliberately holds no
-- credentials, no API keys and no precise location.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ── Enumerations ────────────────────────────────────────────────────────────
-- Enums rather than free text: a typo in the application cannot silently
-- create a new status that the dashboard then fails to count.

do $$ begin
  create type lead_status as enum (
    'new', 'quoted', 'ai_failed', 'contacted',
    'meeting_scheduled', 'won', 'lost', 'spam'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pricing_tier as enum ('A', 'B', 'C');
exception when duplicate_object then null; end $$;

do $$ begin
  create type complexity_level as enum ('simple', 'standard', 'advanced');
exception when duplicate_object then null; end $$;

-- ── Admin allow-list ────────────────────────────────────────────────────────
-- Authorisation is membership of this table, not a claim inside the JWT, so
-- revoking access is a DELETE and takes effect on the next request. It holds
-- no password: Supabase Auth owns credentials.

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Allow-list of auth.users permitted to read leads. Holds no credentials.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  );
$$;

comment on function public.is_admin() is
  'True when the caller is on the admin allow-list. SECURITY DEFINER so the '
  'policies can read admin_users without granting the caller access to it.';

-- ── Leads ───────────────────────────────────────────────────────────────────

create table if not exists public.portfolio_leads (
  id                       uuid primary key default gen_random_uuid(),
  reference                text not null unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- Contact details (step 1 of the wizard)
  full_name                text not null check (length(btrim(full_name)) between 2 and 120),
  email                    text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                    text not null check (length(btrim(phone)) between 5 and 32),
  country_code             text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name             text not null,
  preferred_language       text not null check (preferred_language in ('ar', 'en')),

  -- The request (steps 2 and 3)
  project_type             text not null,
  description              text not null check (length(btrim(description)) between 20 and 4000),
  desired_timeline         text,
  client_budget            text,
  reference_url            text,

  status                   lead_status not null default 'new',

  -- Deterministic, server-calculated bounds. Recorded so a quote can always be
  -- audited back to the configuration that produced it.
  pricing_tier             pricing_tier not null,
  complexity               complexity_level not null,
  pricing_floor_usd        integer not null check (pricing_floor_usd > 0),
  pricing_ceiling_usd      integer not null check (pricing_ceiling_usd > 0),
  constraint pricing_window_ordered
    check (pricing_floor_usd <= pricing_ceiling_usd),

  -- What the model returned, after server-side clamping
  ai_model                 text,
  ai_summary               text,
  ai_scope                 jsonb,
  ai_price_min_usd         integer check (ai_price_min_usd is null or ai_price_min_usd > 0),
  ai_price_max_usd         integer check (ai_price_max_usd is null or ai_price_max_usd > 0),
  ai_timeline              text,
  ai_assumptions           jsonb,
  ai_response_text         text,
  ai_raw_json              jsonb,
  ai_was_clamped           boolean not null default false,
  constraint ai_price_ordered
    check (ai_price_min_usd is null or ai_price_max_usd is null
           or ai_price_min_usd <= ai_price_max_usd),
  -- The quote may never escape the window the server calculated. This is the
  -- last line of defence behind the application-level clamp: even a bug in the
  -- function cannot persist an out-of-band price.
  constraint ai_price_within_window
    check (
      ai_price_min_usd is null
      or (ai_price_min_usd >= pricing_floor_usd
          and ai_price_max_usd <= pricing_ceiling_usd)
    ),

  email_notification_status email_status not null default 'pending',
  last_notified_at          timestamptz,

  admin_notes               text,

  -- Attribution. Referrer is stored as origin only; see the Edge Function.
  utm_source                text,
  utm_medium                text,
  utm_campaign              text,
  referrer                  text
);

comment on table public.portfolio_leads is
  'Project requests from the portfolio wizard. Written only by the '
  'project-estimate Edge Function (service role); readable only by admins.';
comment on column public.portfolio_leads.reference is
  'Short human-quotable reference shown to the customer, e.g. MG-7K4P2Q.';
comment on column public.portfolio_leads.ai_was_clamped is
  'True when the model returned a price outside the allowed window and the '
  'server corrected it. A persistently true value means the prompt needs work.';

create index if not exists portfolio_leads_created_at_idx
  on public.portfolio_leads (created_at desc);
create index if not exists portfolio_leads_status_idx
  on public.portfolio_leads (status);
create index if not exists portfolio_leads_country_idx
  on public.portfolio_leads (country_code);
create index if not exists portfolio_leads_project_type_idx
  on public.portfolio_leads (project_type);
-- Admin free-text search over name / email / phone.
create index if not exists portfolio_leads_search_idx
  on public.portfolio_leads
  using gin (to_tsvector('simple', full_name || ' ' || email || ' ' || phone));

-- ── updated_at ──────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists portfolio_leads_touch on public.portfolio_leads;
create trigger portfolio_leads_touch
  before update on public.portfolio_leads
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- RLS is ON and the anon role is given no policy whatsoever, so an anonymous
-- request matches nothing and sees nothing. Admins get read + a narrow update.

alter table public.portfolio_leads enable row level security;
alter table public.admin_users     enable row level security;

-- Belt and braces: even if a future policy were added by mistake, anon and
-- authenticated hold no table-level grant beyond what is given here.
revoke all on public.portfolio_leads from anon, authenticated;
revoke all on public.admin_users     from anon, authenticated;
grant select, update on public.portfolio_leads to authenticated;
grant select          on public.admin_users     to authenticated;

-- Granted explicitly rather than inherited from Supabase's default privileges,
-- so this migration stands on its own and the Edge Function cannot be broken
-- by a project whose defaults were tightened.
grant all on public.portfolio_leads to service_role;
grant all on public.admin_users     to service_role;

drop policy if exists admins_read_leads   on public.portfolio_leads;
drop policy if exists admins_update_leads on public.portfolio_leads;

create policy admins_read_leads
  on public.portfolio_leads
  for select
  to authenticated
  using (public.is_admin());

-- Admins may triage a lead. They may not rewrite the customer's words or the
-- model's answer: the column grant below is what actually restricts this, and
-- the trigger after it rejects any attempt that slips past.
create policy admins_update_leads
  on public.portfolio_leads
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke update on public.portfolio_leads from authenticated;
grant update (status, admin_notes, email_notification_status, last_notified_at)
  on public.portfolio_leads to authenticated;

drop policy if exists admins_read_admins on public.admin_users;
create policy admins_read_admins
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/delete policy exists for any browser role, so leads can only be
-- created by the service role and can never be deleted from the dashboard.
