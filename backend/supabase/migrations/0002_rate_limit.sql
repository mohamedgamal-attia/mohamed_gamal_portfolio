-- =============================================================================
-- 0002_rate_limit.sql
--
-- Durable throttling for the project-estimate function.
--
-- An Edge Function isolate is short-lived and there may be several at once, so
-- an in-memory counter throttles almost nothing. This table is the shared
-- counter.
--
-- It deliberately stores a SALTED HASH of the caller's IP, never the address:
-- enough to count repeat callers within a window, not enough to identify one
-- afterwards. Rows older than the window are deleted on every call.
-- =============================================================================

create table if not exists public.request_throttle (
  ip_hash      text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 1 check (hits > 0),
  primary key (ip_hash, window_start)
);

comment on table public.request_throttle is
  'Per-IP-hash request counts for the estimate endpoint. Holds no IP address.';

create index if not exists request_throttle_window_idx
  on public.request_throttle (window_start);

alter table public.request_throttle enable row level security;
revoke all on public.request_throttle from anon, authenticated;
grant all  on public.request_throttle to service_role;
-- No policy for anon or authenticated: the browser cannot read or write it.

/**
 * Count one hit and say whether the caller is still within the limit.
 * Returns true when the request is allowed.
 */
create or replace function public.throttle_check(
  p_ip_hash      text,
  p_limit        integer default 5,
  p_window_secs  integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := date_bin(make_interval(secs => p_window_secs), now(), timestamptz 'epoch');
  v_hits   integer;
begin
  delete from public.request_throttle
   where window_start < now() - make_interval(secs => p_window_secs * 2);

  insert into public.request_throttle (ip_hash, window_start, hits)
  values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start)
    do update set hits = public.request_throttle.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.throttle_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.throttle_check(text, integer, integer) to service_role;
