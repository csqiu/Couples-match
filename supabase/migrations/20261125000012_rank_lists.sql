-- Lists and numbered versions (the dashboard).
--
-- A couple can start over as many times as they like. Each fresh start is a
-- "list" (List 1, List 2, …), and each version saved while working on it is
-- numbered within it (2.1, 2.2, …). Saved versions can be starred.
--
-- The couple has one list open at a time, shared by both partners. Its working
-- state lives in the usual tables (individual_ranks, comparisons, pins,
-- pair_exclusions, rule_exceptions, and the list settings in couples.settings),
-- so the engine, row level security and realtime are unchanged. Opening another
-- list parks the open one's state in rank_lists.draft and loads the other's.
--
-- The program list is shared by every list: when a list is loaded, each partner
-- keeps exactly the programs they have now. Tiers, order and "acceptable" come
-- from the list being loaded; programs added since go to Tier B at the end of it.
-- NRMP codes, notes and short names are about the program, so they stay as they are now.

create table public.rank_lists (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  number int not null check (number between 1 and 999),
  name text check (name is null or char_length(name) between 1 and 120),
  -- The saved version whose tiers this list started from (null: blank tiers).
  started_from uuid references public.list_versions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- The parked working state while another list is open; null while this one is open.
  draft jsonb check (draft is null or jsonb_typeof(draft) = 'object'),
  unique (couple_id, number)
);
create index rank_lists_created_by_idx on public.rank_lists (created_by);
create index rank_lists_started_from_idx on public.rank_lists (started_from);

alter table public.couples add column active_list uuid references public.rank_lists (id) on delete set null;
create index couples_active_list_idx on public.couples (active_list);

alter table public.list_versions
  add column list_id uuid references public.rank_lists (id) on delete cascade,
  add column minor int check (minor between 1 and 9999),
  add column starred boolean not null default false;

-- Every couple so far gets List 1, holding all of its versions in the order they were saved.
insert into public.rank_lists (couple_id, number, created_by, created_at)
select c.id, 1, c.partner_a, c.created_at from public.couples c;
update public.couples c set active_list = l.id from public.rank_lists l where l.couple_id = c.id and l.number = 1;
update public.list_versions v
  set list_id = n.list_id, minor = n.minor
  from (
    select v2.id, l.id as list_id, row_number() over (partition by v2.couple_id order by v2.created_at, v2.id) as minor
    from public.list_versions v2 join public.rank_lists l on l.couple_id = v2.couple_id and l.number = 1
  ) n
  where n.id = v.id;
alter table public.list_versions alter column list_id set not null, alter column minor set not null;
alter table public.list_versions add constraint list_versions_list_minor_unique unique (list_id, minor);
create index list_versions_list_idx on public.list_versions (list_id, minor desc);

-- ---------------------------------------------------------------------------
-- New couples start with List 1 open.

create or replace function public.create_first_list()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lid uuid;
begin
  insert into public.rank_lists (couple_id, number, created_by) values (new.id, 1, new.partner_a) returning id into lid;
  update public.couples set active_list = lid where id = new.id;
  return null;
end;
$$;
create trigger couples_first_list
  after insert on public.couples
  for each row execute function public.create_first_list();

-- A saved version always belongs to the open list and takes its next number
-- (whatever the client sent). The list row is locked so two saves can't share one.
create or replace function public.number_list_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  lid uuid;
begin
  select c.active_list into lid from public.couples c where c.id = new.couple_id;
  if lid is null then
    raise exception 'no_open_list' using errcode = 'P0001';
  end if;
  perform 1 from public.rank_lists where id = lid for update;
  new.list_id := lid;
  new.minor := coalesce((select max(v.minor) from public.list_versions v where v.list_id = lid), 0) + 1;
  return new;
end;
$$;
create trigger list_versions_number
  before insert on public.list_versions
  for each row execute function public.number_list_version();

-- Versions stay frozen apart from their name, note and star.
create or replace function public.protect_list_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.couple_id, new.created_at, new.engine_version, new.inputs_snapshot, new.pairs, new.is_frozen, new.list_id, new.minor)
     is distinct from
     (old.couple_id, old.created_at, old.engine_version, old.inputs_snapshot, old.pairs, old.is_frozen, old.list_id, old.minor)
     -- The author may only become unknown (their account was deleted).
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'version_is_frozen' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

grant update (starred) on public.list_versions to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: members read their lists and may rename them; starting
-- and opening lists go through the functions below.

alter table public.rank_lists enable row level security;
create policy "members read lists" on public.rank_lists for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members rename lists" on public.rank_lists for update to authenticated
  using (public.is_active_member(couple_id)) with check (public.is_active_member(couple_id));
grant select on public.rank_lists to authenticated;
grant update (name) on public.rank_lists to authenticated;

-- ---------------------------------------------------------------------------
-- Quiet bulk changes: opening or starting a list rewrites every working row, which
-- shouldn't flood the activity feed with "added 40 programs". Those functions set
-- pairwise.quiet for their transaction and log one event of their own instead.

create or replace function public.log_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('pairwise.quiet', true), '') = 'on' then
    return null;
  end if;
  insert into public.audit_events (couple_id, user_id, type, payload)
  select ch.couple_id, public.acting_user(), tg_table_name || '.' || lower(tg_op), jsonb_build_object('count', count(*))
  from changed ch
  where exists (select 1 from public.couples c where c.id = ch.couple_id)
  group by ch.couple_id;
  return null;
end;
$$;

create or replace function public.log_couple_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.settings is distinct from old.settings and coalesce(current_setting('pairwise.quiet', true), '') <> 'on' then
    insert into public.audit_events (couple_id, user_id, type, payload)
    values (new.id, public.acting_user(), 'couples.settings', jsonb_build_object('changed', (
      select coalesce(jsonb_agg(k), '[]'::jsonb) from (
        select key as k from jsonb_each(new.settings)
        where new.settings -> key is distinct from old.settings -> key
        union
        select key from jsonb_each(old.settings) where not new.settings ? key
      ) keys)));
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_events (couple_id, user_id, type, payload)
    values (new.id, public.acting_user(), 'couples.' || new.status::text, '{}'::jsonb);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parking and loading a list's working state.

-- Settings that belong to a list rather than the couple.
create or replace function public.list_setting_keys()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['listLength', 'includedPairs', 'noMatchUnlocked', 'listOrder', 'deferredQuestions', 'flaggedQuestions'];
$$;

-- The couple's working state as one JSON object.
create or replace function public.capture_list_state(p_couple uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'ranks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', r.user_id, 'programId', r.program_id, 'rank', r.rank, 'tier', r.tier,
        'acceptable', r.acceptable, 'note', r.note, 'nrmpCode', r.nrmp_code, 'shortName', r.short_name) order by r.user_id, r.rank)
      from public.individual_ranks r where r.couple_id = p_couple), '[]'::jsonb),
    'comparisons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'left', x.pair_left, 'right', x.pair_right, 'winner', x.winner, 'answeredBy', x.answered_by,
        'bothAgreed', x.both_agreed, 'locked', x.locked, 'createdAt', x.created_at) order by x.seq)
      from public.comparisons x where x.couple_id = p_couple), '[]'::jsonb),
    'pins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'higher', p.higher_pair, 'lower', p.lower_pair, 'source', p.source, 'comparisonId', p.comparison_id,
        'moved', p.moved_pair, 'createdBy', p.created_by) order by p.created_at, p.id)
      from public.pins p where p.couple_id = p_couple), '[]'::jsonb),
    'exclusions', coalesce((
      select jsonb_agg(jsonb_build_object('programA', e.program_a, 'programB', e.program_b, 'reason', e.reason, 'createdBy', e.created_by))
      from public.pair_exclusions e where e.couple_id = p_couple), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(jsonb_build_object('higher', e.higher_pair, 'lower', e.lower_pair, 'createdBy', e.created_by))
      from public.rule_exceptions e where e.couple_id = p_couple), '[]'::jsonb),
    'settings', (
      select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
      from public.couples c, jsonb_each(c.settings) s
      where c.id = p_couple and s.key = any (public.list_setting_keys()))
  );
$$;

-- Replaces the couple's working state.
--  p_current: capture_list_state() of what's being replaced (the program list to keep).
--  p_state:   the state to load; its ranks give tiers and order. Null: blank tiers.
create or replace function public.load_list_state(p_couple uuid, p_current jsonb, p_state jsonb)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st jsonb := coalesce(p_state, '{}'::jsonb);
begin
  delete from public.comparisons where couple_id = p_couple; -- their pins go with them
  delete from public.pins where couple_id = p_couple;
  delete from public.pair_exclusions where couple_id = p_couple;
  delete from public.rule_exceptions where couple_id = p_couple;
  delete from public.individual_ranks where couple_id = p_couple;

  insert into public.individual_ranks (couple_id, user_id, program_id, rank, tier, acceptable, note, nrmp_code, short_name)
  select p_couple, cur.user_id, cur.program_id,
         row_number() over (
           partition by cur.user_id
           order by coalesce(prev.tier, 'B'::public.tier), (prev.rank is null), coalesce(prev.rank, cur.rank)),
         coalesce(prev.tier, 'B'::public.tier), coalesce(prev.acceptable, true), cur.note, cur.nrmp_code, cur.short_name
  from (
    select (e->>'userId')::uuid as user_id, e->>'programId' as program_id, (e->>'rank')::int as rank,
           e->>'note' as note, nullif(e->>'nrmpCode', '') as nrmp_code, nullif(btrim(e->>'shortName'), '') as short_name
    from jsonb_array_elements(coalesce(p_current->'ranks', '[]'::jsonb)) e
  ) cur
  left join (
    select (e->>'userId')::uuid as user_id, e->>'programId' as program_id, (e->>'rank')::int as rank,
           (e->>'tier')::public.tier as tier, coalesce((e->>'acceptable')::boolean, true) as acceptable
    from jsonb_array_elements(coalesce(st->'ranks', '[]'::jsonb)) e
  ) prev on prev.user_id = cur.user_id and prev.program_id = cur.program_id;

  insert into public.comparisons (id, couple_id, pair_left, pair_right, winner, answered_by, both_agreed, locked, created_at)
  select (e->>'id')::uuid, p_couple, e->>'left', e->>'right', (e->>'winner')::public.comparison_winner,
         (select u.id from auth.users u where u.id = (e->>'answeredBy')::uuid),
         coalesce((e->>'bothAgreed')::boolean, false), coalesce((e->>'locked')::boolean, false),
         coalesce((e->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(st->'comparisons', '[]'::jsonb)) with ordinality as t(e, i)
  where (e->>'id') ~ '^[0-9a-f-]{36}$'
  order by i;

  insert into public.pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by, moved_pair, created_at)
  select p_couple, e->>'higher', e->>'lower', (e->>'source')::public.pin_source,
         (select x.id from public.comparisons x where x.id::text = e->>'comparisonId'),
         (select u.id from auth.users u where u.id = (e->>'createdBy')::uuid),
         case when e->>'moved' in ('higher', 'lower') then e->>'moved' end,
         now() + (i * interval '1 microsecond')
  from jsonb_array_elements(coalesce(st->'pins', '[]'::jsonb)) with ordinality as t(e, i);

  insert into public.pair_exclusions (couple_id, program_a, program_b, reason, created_by)
  select p_couple, e->>'programA', e->>'programB', e->>'reason',
         (select u.id from auth.users u where u.id = (e->>'createdBy')::uuid)
  from jsonb_array_elements(coalesce(st->'exclusions', '[]'::jsonb)) e
  on conflict do nothing;

  insert into public.rule_exceptions (couple_id, higher_pair, lower_pair, created_by)
  select p_couple, e->>'higher', e->>'lower', (select u.id from auth.users u where u.id = (e->>'createdBy')::uuid)
  from jsonb_array_elements(coalesce(st->'exceptions', '[]'::jsonb)) e
  on conflict do nothing;

  update public.couples
    set settings = (settings - public.list_setting_keys()) || coalesce(st->'settings', '{}'::jsonb)
    where id = p_couple;
end;
$$;

-- Opens another of the couple's lists (for both partners).
create or replace function public.open_list(p_list uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  l public.rank_lists%rowtype;
  c public.couples%rowtype;
  cur jsonb;
begin
  select * into l from public.rank_lists where id = p_list;
  if not found or not public.is_active_member(l.couple_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into c from public.couples where id = l.couple_id for update;
  if c.active_list = l.id then
    return;
  end if;
  perform set_config('pairwise.quiet', 'on', true);
  cur := public.capture_list_state(c.id);
  update public.rank_lists set draft = cur where id = c.active_list;
  perform public.load_list_state(c.id, cur, l.draft);
  update public.rank_lists set draft = null where id = l.id;
  update public.couples set active_list = l.id where id = c.id;
  perform set_config('pairwise.quiet', 'off', true);
  insert into public.audit_events (couple_id, user_id, type, payload)
  values (c.id, public.acting_user(), 'rank_lists.opened', jsonb_build_object('number', l.number));
end;
$$;

-- Starts a new list and opens it: the same programs, no answers yet, and tiers
-- either blank (everything in Tier B, in today's order) or copied from a saved version.
create or replace function public.start_list(p_name text default null, p_from_version uuid default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  c public.couples%rowtype;
  v public.list_versions%rowtype;
  cur jsonb;
  tiers jsonb := null;
  n int;
  lid uuid;
  clean text := nullif(btrim(coalesce(p_name, '')), '');
begin
  select * into c from public.couples
    where status <> 'dissolved' and (select auth.uid()) in (partner_a, partner_b)
    order by created_at desc limit 1
    for update;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_from_version is not null then
    select * into v from public.list_versions where id = p_from_version and couple_id = c.id;
    if not found then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    -- A version stores lists[0] for partner A and lists[1] for partner B.
    tiers := jsonb_build_object('ranks', coalesce((
      select jsonb_agg(e || jsonb_build_object('userId', case side when 0 then c.partner_a else c.partner_b end))
      from generate_series(0, 1) side,
           jsonb_array_elements(coalesce(v.inputs_snapshot->'lists'->side, '[]'::jsonb)) e
      where (case side when 0 then c.partner_a else c.partner_b end) is not null), '[]'::jsonb));
  end if;

  perform set_config('pairwise.quiet', 'on', true);
  cur := public.capture_list_state(c.id);
  update public.rank_lists set draft = cur where id = c.active_list;
  select coalesce(max(number), 0) + 1 into n from public.rank_lists where couple_id = c.id;
  insert into public.rank_lists (couple_id, number, name, started_from, created_by)
  values (c.id, n, left(clean, 120), p_from_version, (select auth.uid()))
  returning id into lid;
  perform public.load_list_state(c.id, cur, tiers);
  update public.couples set active_list = lid where id = c.id;
  perform set_config('pairwise.quiet', 'off', true);
  insert into public.audit_events (couple_id, user_id, type, payload)
  values (c.id, public.acting_user(), 'rank_lists.started', jsonb_build_object('number', n));
  return lid;
end;
$$;

-- Restoring a version only makes sense inside its own list (and now keeps short names).
create or replace function public.restore_version(p_version uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v public.list_versions%rowtype;
  c public.couples%rowtype;
  snap jsonb;
  side int;
  owner uuid;
begin
  select * into v from public.list_versions where id = p_version;
  if not found or not public.is_active_member(v.couple_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into c from public.couples where id = v.couple_id for update;
  if c.active_list is distinct from v.list_id then
    raise exception 'version_in_other_list' using errcode = 'P0001';
  end if;
  snap := v.inputs_snapshot;

  delete from public.comparisons where couple_id = c.id; -- their pins go with them
  delete from public.pins where couple_id = c.id;
  delete from public.pair_exclusions where couple_id = c.id;
  delete from public.rule_exceptions where couple_id = c.id;
  delete from public.individual_ranks where couple_id = c.id;

  -- Rank lists: lists[0] is partner A's, lists[1] partner B's. Programs that no
  -- longer exist (or aren't available to this couple) are skipped.
  for side in 0..1 loop
    owner := case side when 0 then c.partner_a else c.partner_b end;
    continue when owner is null;
    insert into public.individual_ranks (couple_id, user_id, program_id, rank, tier, acceptable, note, nrmp_code, short_name)
    select c.id, owner, e->>'programId', (e->>'rank')::int, (e->>'tier')::public.tier,
           coalesce((e->>'acceptable')::boolean, true), e->>'note', nullif(e->>'nrmpCode', ''), nullif(btrim(e->>'shortName'), '')
    from jsonb_array_elements(coalesce(snap->'lists'->side, '[]'::jsonb)) e
    join public.programs p on p.id = e->>'programId'
    where p.created_by_couple is null or p.created_by_couple = c.id;
  end loop;

  insert into public.comparisons (id, couple_id, pair_left, pair_right, winner, answered_by, both_agreed, locked)
  select (e->>'id')::uuid, c.id, e->>'left', e->>'right', (e->>'winner')::public.comparison_winner,
         (select u.id from auth.users u where u.id = (e->>'answeredBy')::uuid),
         coalesce((e->>'bothAgreed')::boolean, false), coalesce((e->>'locked')::boolean, false)
  from jsonb_array_elements(coalesce(snap->'comparisons', '[]'::jsonb)) e
  where (e->>'id') ~ '^[0-9a-f-]{36}$'
  order by (e->>'seq')::bigint nulls last;

  -- Pins keep their order (drags are replayed in the order they were made).
  insert into public.pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by, moved_pair, created_at)
  select c.id, e->>'higher', e->>'lower', (e->>'source')::public.pin_source,
         (select x.id from public.comparisons x where x.id::text = e->>'comparisonId'), (select auth.uid()),
         case when e->>'moved' in ('higher', 'lower') then e->>'moved' end,
         now() + (i * interval '1 microsecond')
  from jsonb_array_elements(coalesce(snap->'pins', '[]'::jsonb)) with ordinality as t(e, i);

  insert into public.pair_exclusions (couple_id, program_a, program_b, reason, created_by)
  select c.id, e->>'programA', e->>'programB', e->>'reason', (select auth.uid())
  from jsonb_array_elements(coalesce(snap->'exclusions', '[]'::jsonb)) e
  on conflict do nothing;

  insert into public.rule_exceptions (couple_id, higher_pair, lower_pair, created_by)
  select c.id, e->>'higher', e->>'lower', (select auth.uid())
  from jsonb_array_elements(coalesce(snap->'exceptions', '[]'::jsonb)) e
  on conflict do nothing;

  -- Engine settings come back from the version; app-only settings (privacy) stay as they are.
  update public.couples
    set settings = settings || ((coalesce(snap->'settings', '{}'::jsonb)) - 'matchType')
    where id = c.id;

  insert into public.audit_events (couple_id, user_id, type, payload)
  values (c.id, public.acting_user(), 'list_versions.restored', jsonb_build_object('version', v.id, 'name', v.name));
end;
$$;

revoke all on function
  public.create_first_list(), public.number_list_version(), public.list_setting_keys(),
  public.capture_list_state(uuid), public.load_list_state(uuid, jsonb, jsonb),
  public.open_list(uuid), public.start_list(text, uuid), public.restore_version(uuid)
  from public, anon, authenticated;
grant execute on function public.open_list(uuid), public.start_list(text, uuid), public.restore_version(uuid) to authenticated;

-- Realtime: a partner opening or starting a list refreshes the other's pages.
do $$
begin
  execute 'alter table public.rank_lists replica identity full';
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.rank_lists';
  end if;
end;
$$;
