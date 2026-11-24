import 'server-only';
import type { CoupleData, StoredSettings } from '@pairwise/db';
import { displayName, type AppContext } from './context';
import { createClient } from './supabase/server';

export interface CoupleBundle {
  data: CoupleData;
  me: string;
  /** [partner A's name, partner B's name] — "Partner 1" and "Partner 2" in the engine. */
  names: [string, string];
  answerMode: 'together' | 'separately';
  privateTiers: boolean;
}

/** Everything the engine needs about the couple, read as the signed-in member (RLS applies). */
export async function loadCoupleBundle(ctx: AppContext & { couple: NonNullable<AppContext['couple']> }): Promise<CoupleBundle> {
  const supabase = await createClient();
  const id = ctx.couple.id;
  const [ranks, comparisons, pins, exclusions, exceptions] = await Promise.all([
    supabase.from('individual_ranks').select('user_id, program_id, rank, tier, acceptable, note, nrmp_code').eq('couple_id', id),
    supabase.from('comparisons').select('id, pair_left, pair_right, winner, answered_by, both_agreed, locked, seq').eq('couple_id', id).order('seq'),
    supabase.from('pins').select('id, higher_pair, lower_pair, source, comparison_id, moved_pair').eq('couple_id', id).order('created_at').order('id'),
    supabase.from('pair_exclusions').select('program_a, program_b, reason').eq('couple_id', id),
    supabase.from('rule_exceptions').select('higher_pair, lower_pair').eq('couple_id', id),
  ]);
  const programIds = [...new Set((ranks.data ?? []).map((r) => r.program_id))];
  const { data: programs } = programIds.length
    ? await supabase
        .from('programs')
        .select('id, name, short_name, institution, city, state, lat, lon, cbsa_code, nrmp_code, is_advanced')
        .in('id', programIds)
    : { data: [] };

  const me = ctx.user.id;
  const mine = displayName(ctx.profile, 'You');
  const partner = displayName(ctx.partner, 'Your partner');
  const settings = (ctx.couple.settings ?? {}) as StoredSettings;
  return {
    data: {
      couple: {
        id,
        partner_a: ctx.couple.partner_a,
        partner_b: ctx.couple.partner_b,
        match_type: ctx.couple.match_type,
        settings: ctx.couple.settings,
      },
      programs: programs ?? [],
      ranks: ranks.data ?? [],
      comparisons: comparisons.data ?? [],
      pins: pins.data ?? [],
      exclusions: exclusions.data ?? [],
      exceptions: exceptions.data ?? [],
    },
    me,
    names: ctx.role === 'a' ? [mine, partner] : [partner, mine],
    answerMode: settings.answerMode === 'separately' ? 'separately' : 'together',
    privateTiers: settings.privacy === 'private_tiers',
  };
}
