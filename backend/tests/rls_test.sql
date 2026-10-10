\set ON_ERROR_STOP off
\pset pager off
\t on

-- Two auth users: one admin, one not.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','admin@example.test'),
  ('22222222-2222-2222-2222-222222222222','someone@example.test')
on conflict do nothing;
insert into public.admin_users (user_id, email)
  values ('11111111-1111-1111-1111-111111111111','admin@example.test')
on conflict do nothing;

create or replace function t(label text, sql text, expect text) returns void
language plpgsql as $$
declare got text; begin
  begin execute sql into got; exception when others then got := 'ERROR:'||SQLERRM; end;
  if (expect = 'ERROR' and got like 'ERROR:%') or got = expect then
    raise notice 'PASS  %  -> %', rpad(label,52), left(coalesce(got,'null'),58);
  else
    raise notice 'FAIL  %  -> % (expected %)', rpad(label,52), left(coalesce(got,'null'),58), expect;
  end if;
end $$;

-- ── service role writes the lead (as the Edge Function would) ───────────────
set role service_role;
insert into public.portfolio_leads
  (reference, full_name, email, phone, country_code, country_name,
   preferred_language, project_type, description, pricing_tier, complexity,
   pricing_floor_usd, pricing_ceiling_usd, ai_price_min_usd, ai_price_max_usd)
values
  ('MG-TEST01','Test Person','t@example.test','+201234567890','EG','Egypt',
   'ar','erp_business_system','A reasonably detailed description of the system that is needed here.',
   'C','standard', 700, 2800, 900, 1600);
reset role;

-- ── anonymous: must see and do nothing ──────────────────────────────────────
set role anon;
select t('anon SELECT leads',        'select count(*)::text from public.portfolio_leads', 'ERROR');
select t('anon INSERT lead',         'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''X'',''a b'',''a@b.co'',''12345'',''EG'',''Egypt'',''en'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('anon UPDATE lead',         'with x as (update public.portfolio_leads set status=''won'' returning 1) select count(*)::text from x', 'ERROR');
select t('anon DELETE lead',         'with x as (delete from public.portfolio_leads returning 1) select count(*)::text from x', 'ERROR');
select t('anon SELECT admin_users',  'select count(*)::text from public.admin_users', 'ERROR');
reset role;

-- ── authenticated but NOT an admin ──────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t('non-admin SELECT leads (rows visible)', 'select count(*)::text from public.portfolio_leads', '0');
select t('non-admin UPDATE status (rows hit)',    'with x as (update public.portfolio_leads set status=''won'' returning 1) select count(*)::text from x', '0');
select t('non-admin DELETE',                      'with x as (delete from public.portfolio_leads returning 1) select count(*)::text from x', 'ERROR');
reset role; reset request.jwt.claim.sub;

-- ── authenticated admin ─────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t('admin SELECT leads',                'select count(*)::text from public.portfolio_leads', '1');
select t('admin UPDATE status',               'with x as (update public.portfolio_leads set status=''contacted'' returning 1) select count(*)::text from x', '1');
select t('admin UPDATE admin_notes',          'with x as (update public.portfolio_leads set admin_notes=''called'' returning 1) select count(*)::text from x', '1');
select t('admin UPDATE description (denied)', 'with x as (update public.portfolio_leads set description=''tampered with by admin'' returning 1) select count(*)::text from x', 'ERROR');
select t('admin UPDATE ai_price (denied)',    'with x as (update public.portfolio_leads set ai_price_min_usd=1 returning 1) select count(*)::text from x', 'ERROR');
select t('admin UPDATE email (denied)',       'with x as (update public.portfolio_leads set email=''new@x.co'' returning 1) select count(*)::text from x', 'ERROR');
select t('admin DELETE (denied)',             'with x as (delete from public.portfolio_leads returning 1) select count(*)::text from x', 'ERROR');
select t('admin INSERT (denied)',             'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''Y'',''a b'',''a@b.co'',''12345'',''EG'',''Egypt'',''en'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('admin sees only own admin_users row','select count(*)::text from public.admin_users', '1');
reset role; reset request.jwt.claim.sub;

-- ── data integrity constraints (as service role) ────────────────────────────
set role service_role;
select t('price below floor rejected',  'with x as (update public.portfolio_leads set ai_price_min_usd=10 returning 1) select count(*)::text from x', 'ERROR');
select t('price above ceiling rejected','with x as (update public.portfolio_leads set ai_price_max_usd=99999 returning 1) select count(*)::text from x', 'ERROR');
select t('NULL max with a min below floor rejected', 'with x as (update public.portfolio_leads set ai_price_min_usd=10, ai_price_max_usd=null returning 1) select count(*)::text from x', 'ERROR');
select t('NULL min with a max above ceiling rejected', 'with x as (update public.portfolio_leads set ai_price_min_usd=null, ai_price_max_usd=99999 returning 1) select count(*)::text from x', 'ERROR');
select t('half-set price pair rejected',               'with x as (update public.portfolio_leads set ai_price_min_usd=1000, ai_price_max_usd=null returning 1) select count(*)::text from x', 'ERROR');
select t('both NULL accepted (no quote yet)',          'with x as (update public.portfolio_leads set ai_price_min_usd=null, ai_price_max_usd=null returning 1) select count(*)::text from x', '1');
select t('valid pair restored',                        'with x as (update public.portfolio_leads set ai_price_min_usd=900, ai_price_max_usd=1600 returning 1) select count(*)::text from x', '1');
select t('min>max rejected',            'with x as (update public.portfolio_leads set ai_price_min_usd=1600, ai_price_max_usd=900 returning 1) select count(*)::text from x', 'ERROR');
select t('bad email rejected',          'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''Z1'',''a b'',''not-an-email'',''12345'',''EG'',''Egypt'',''en'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('bad language rejected',       'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''Z2'',''a b'',''a@b.co'',''12345'',''EG'',''Egypt'',''fr'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('lowercase country rejected',  'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''Z3'',''a b'',''a@b.co'',''12345'',''eg'',''Egypt'',''en'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('short description rejected',  'with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''Z4'',''a b'',''a@b.co'',''12345'',''EG'',''Egypt'',''en'',''portfolio'',''too short'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
select t('duplicate reference rejected','with x as (insert into public.portfolio_leads (reference,full_name,email,phone,country_code,country_name,preferred_language,project_type,description,pricing_tier,complexity,pricing_floor_usd,pricing_ceiling_usd) values (''MG-TEST01'',''a b'',''a@b.co'',''12345'',''EG'',''Egypt'',''en'',''portfolio'',''aaaaaaaaaaaaaaaaaaaaaa'',''C'',''simple'',100,200) returning 1) select count(*)::text from x', 'ERROR');
reset role;

-- updated_at trigger
set role service_role;
select t('updated_at advances on update',
  $q$ with b as (select updated_at u from public.portfolio_leads where reference='MG-TEST01'),
          x as (update public.portfolio_leads set status='won' where reference='MG-TEST01' returning updated_at)
      select ((select updated_at from x) > (select u from b))::text $q$, 'true');
select t('row really exists', 'select count(*)::text from public.portfolio_leads', '1');
reset role;
