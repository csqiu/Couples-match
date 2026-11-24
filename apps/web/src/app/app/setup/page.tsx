import { DEFAULT_DISTANCE_BANDS } from '@pairwise/engine';
import type { StoredSettings } from '@pairwise/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { displayName, requireContext } from '@/lib/context';
import { matchYearOptions } from '@/lib/match-year';
import { createClient } from '@/lib/supabase/server';
import { InviteForm, ProfileForm, SettingsForm, StartCoupleForm, type SpecialtyOption } from './forms';

export const metadata: Metadata = { title: 'Setup' };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { joined } = await searchParams;
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: specialtyRows } = await supabase.from('specialties').select('*').neq('match_type', 'other').neq('code', 'no-match').order('name');
  const specialties: SpecialtyOption[] = (specialtyRows ?? []).map((s) => ({
    code: s.code,
    name: s.name,
    group: s.match_type === 'main' ? 'Residency (Main Residency Match)' : `Fellowship (${s.match_name})`,
  }));
  const settings = (ctx.couple?.settings ?? {}) as StoredSettings;
  // If a couple ended recently, say so: otherwise the partner who stayed just finds themselves back at setup.
  const { data: ended } = ctx.couple
    ? { data: null }
    : await supabase
        .from('couples')
        .select('dissolved_at')
        .eq('status', 'dissolved')
        .gt('dissolved_at', new Date(Date.now() - 30 * 86400_000).toISOString())
        .order('dissolved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
  const matchLabel = ctx.specialty
    ? ctx.specialty.match_type === 'main'
      ? 'the Main Residency Match'
      : `the ${ctx.specialty.match_name} fellowship match`
    : '';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome{ctx.profile.display_name ? `, ${ctx.profile.display_name}` : ''}</h1>
        <p className="mt-1 text-sm text-muted">A few details, then you’ll pick and rank your programs.</p>
      </div>
      {ended?.dissolved_at ? (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" role="status">
          Your couple ended on {new Date(ended.dissolved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Its lists are
          kept for 30 days, then deleted. You can start a new couple below.
        </p>
      ) : null}
      {joined ? (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent" role="status">
          You’ve joined {displayName(ctx.partner)}. You can each build your own list now.
        </p>
      ) : null}

      <Card>
        <CardHeader title="About you" />
        <ProfileForm displayName={ctx.profile.display_name ?? ''} specialty={ctx.profile.specialty} specialties={specialties} />
      </Card>

      {ctx.profile.specialty ? (
        <Card>
          <CardHeader
            title="Your couple"
            action={
              ctx.couple ? (
                <Badge tone={ctx.couple.status === 'active' ? 'accent' : 'warn'}>
                  {ctx.couple.status === 'active' ? 'Linked' : 'Waiting for partner'}
                </Badge>
              ) : null
            }
          />
          {!ctx.couple ? (
            <StartCoupleForm years={matchYearOptions()} matchLabel={matchLabel} />
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-muted">
                {ctx.couple.match_type === 'main' ? 'Main Residency Match' : ctx.couple.match_name} · {ctx.couple.match_year}
                {ctx.partner ? <> · with <strong className="text-text">{displayName(ctx.partner)}</strong></> : null}
              </p>
              {ctx.couple.status === 'pending' && ctx.role === 'a' ? <InviteForm openInvite={ctx.openInvite} /> : null}
              {ctx.couple.status === 'pending' ? (
                <p className="text-xs text-muted">You can start choosing programs while you wait.</p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      {ctx.couple ? (
        <Card>
          <CardHeader title="Couple settings" description="Shared by both of you. You can change these any time." />
          <SettingsForm
            privacy={settings.privacy ?? 'shared'}
            answerMode={settings.answerMode ?? 'together'}
            bands={{ ...DEFAULT_DISTANCE_BANDS, ...(settings.distanceBands ?? {}) }}
          />
        </Card>
      ) : null}

      {ctx.couple ? (
        <div className="flex justify-end">
          <Link href="/app/programs" className={buttonVariants()}>Next: choose programs</Link>
        </div>
      ) : null}
    </div>
  );
}
