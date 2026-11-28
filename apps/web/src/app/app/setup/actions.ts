'use server';
import { DEFAULT_DISTANCE_BANDS } from '@pairwise/engine';
import type { StoredSettings } from '@pairwise/db';
import { revalidatePath } from 'next/cache';
import { APP_URL, SUPABASE_URL } from '@/lib/env';
import { requireContext } from '@/lib/context';
import { matchYearOptions } from '@/lib/match-year';
import { updateCoupleSettings } from '@/lib/couple-settings';
import { createClient } from '@/lib/supabase/server';

export interface FormState {
  ok?: string;
  error?: string;
  inviteLink?: string;
}

const ERRORS: Record<string, string> = {
  already_in_couple: 'You’re already in a couple for that match year.',
  cannot_invite_self: 'Invite your partner’s email, not your own.',
  invalid_email: 'Enter a valid email address.',
  couple_not_pending: 'Your partner has already joined.',
  not_allowed: 'Only the partner who started the couple can do that.',
};
const friendly = (msg: string) => ERRORS[Object.keys(ERRORS).find((k) => msg.includes(k)) ?? ''] ?? msg;

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const display_name = String(form.get('display_name') ?? '').trim().slice(0, 60) || null;
  const specialty = String(form.get('specialty') ?? '') || null;
  if (ctx.couple && specialty !== ctx.profile.specialty && ctx.profile.specialty) {
    const { data: s } = await supabase.from('specialties').select('match_type, match_name').eq('code', specialty!).single();
    if (s && (s.match_type !== ctx.couple.match_type || s.match_name !== ctx.couple.match_name)) {
      return { error: 'That specialty is in a different match than your couple.' };
    }
  }
  const { error } = await supabase.from('profiles').update({ display_name, specialty }).eq('user_id', ctx.user.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { ok: 'Saved.' };
}

export async function startCouple(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  if (ctx.couple) return { error: 'You already have a couple.' };
  const supabase = await createClient();
  const year = Number(form.get('match_year'));
  if (!matchYearOptions().includes(year)) return { error: 'Pick a match year.' };
  const { data: s } = await supabase.from('specialties').select('match_type, match_name').eq('code', ctx.profile.specialty ?? '').single();
  if (!s || s.match_type === 'other') return { error: 'Choose a specialty that is in the NRMP first.' };
  const { error } = await supabase.from('couples').insert({
    partner_a: ctx.user.id,
    match_type: s.match_type as 'main' | 'sms_fellowship',
    match_name: s.match_name,
    match_year: year,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath('/app', 'layout');
  return { ok: 'Couple started. Now invite your partner.' };
}

/**
 * Sends the invite by email when email is configured (the token then never
 * reaches the browser). Without email, returns a link partner A can share.
 */
export async function invitePartner(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  if (!ctx.couple) return { error: 'Start your couple first.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-invite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupleId: ctx.couple.id, email }),
    }).catch(() => null);
    if (res?.ok) {
      revalidatePath('/app/setup');
      return { ok: `Invite emailed to ${email}.` };
    }
    const body = res ? await res.json().catch(() => ({})) : {};
    if (res && res.status !== 503 && body.error !== 'email_not_configured') {
      return { error: friendly(String(body.error ?? 'Could not send the invite.')) };
    }
  }

  // Email isn't set up: create the invite here and let partner A share the link.
  const { data, error } = await supabase.rpc('create_invite', { p_couple: ctx.couple.id, p_email: email });
  if (error || !data?.[0]) return { error: friendly(error?.message ?? 'Could not create the invite.') };
  revalidatePath('/app/setup');
  return {
    ok: `Invite created for ${email}. Email isn’t set up yet, so send them this link yourself — it works once, only for that email, for 7 days.`,
    inviteLink: `${APP_URL}/invite/${data[0].token}`,
  };
}

/**
 * A fresh invite link to copy and send yourself, whether or not email is set up
 * (bug log #2). It replaces any earlier invite or link.
 */
export async function newInviteLink(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  if (!ctx.couple) return { error: 'Start your couple first.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase() || ctx.openInvite?.email || '';
  if (!email) return { error: 'Enter your partner’s email first: the link only works for that address.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_invite', { p_couple: ctx.couple.id, p_email: email });
  if (error || !data?.[0]) return { error: friendly(error?.message ?? 'Could not create the link.') };
  revalidatePath('/app/setup');
  return {
    ok: `New link for ${email}. Send it to them yourself — it works once, only for that email, for 7 days. Earlier links no longer work.`,
    inviteLink: `${APP_URL}/invite/${data[0].token}`,
  };
}

export async function revokeInvite(inviteId: string) {
  const supabase = await createClient();
  await supabase.rpc('revoke_invite', { p_invite: inviteId });
  revalidatePath('/app/setup');
}

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireContext();
  if (!ctx.couple) return { error: 'No couple yet.' };
  const num = (k: string, d: number) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : d;
  };
  const togetherMi = num('togetherMi', DEFAULT_DISTANCE_BANDS.togetherMi);
  const commutableMi = num('commutableMi', DEFAULT_DISTANCE_BANDS.commutableMi);
  const drivableMi = num('drivableMi', DEFAULT_DISTANCE_BANDS.drivableMi);
  if (!(togetherMi < commutableMi && commutableMi < drivableMi)) {
    return { error: 'Distances must increase: Together < Commutable < Drivable.' };
  }
  // Only these three change; everything else is read fresh, so a partner's changes since the
  // page loaded (added pairs, flagged questions, list length…) aren't undone (bug log #38).
  const { error } = await updateCoupleSettings((s: StoredSettings) => ({
    ...s,
    privacy: form.get('privacy') === 'private_tiers' ? 'private_tiers' : 'shared',
    answerMode: form.get('answerMode') === 'separately' ? 'separately' : 'together',
    distanceBands: { togetherMi, commutableMi, drivableMi },
  }));
  if (error) return { error };
  return { ok: 'Settings saved.' };
}
