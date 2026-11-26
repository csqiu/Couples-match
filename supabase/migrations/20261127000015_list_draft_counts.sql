-- The dashboard's counts for lists that aren't open (bug log #43).
--
-- A closed list's working state is parked whole in rank_lists.draft. The dashboard only
-- needs how many programs each partner has, how many answers and how many resolved
-- conflicts, so it asks for those instead of downloading every draft.
-- Security invoker: row level security on rank_lists decides which lists are counted.

create or replace function public.list_draft_counts(p_couple uuid)
returns table (list_id uuid, programs jsonb, answers int, resolved int)
language sql stable security invoker set search_path = ''
as $$
  select l.id,
         coalesce((
           select jsonb_object_agg(u.user_id, u.n)
           from (
             select r->>'userId' as user_id, count(*) as n
             from jsonb_array_elements(coalesce(l.draft->'ranks', '[]'::jsonb)) r
             where r->>'userId' is not null
             group by 1
           ) u), '{}'::jsonb),
         jsonb_array_length(coalesce(l.draft->'comparisons', '[]'::jsonb)),
         jsonb_array_length(coalesce(l.draft->'exceptions', '[]'::jsonb))
  from public.rank_lists l
  where l.couple_id = p_couple and l.draft is not null;
$$;

revoke all on function public.list_draft_counts(uuid) from public, anon;
grant execute on function public.list_draft_counts(uuid) to authenticated;
