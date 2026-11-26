import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { displayName, requireContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { DeleteAccount, LeaveCouple } from './account-forms';
import { AppearanceCard } from './appearance-card';

export const metadata: Metadata = { title: 'Account' };

const PURGE_DAYS = 30;

export default async function AccountPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: ended } = await supabase
    .from('couples')
    .select('id, match_year, dissolved_at')
    .eq('status', 'dissolved')
    .order('dissolved_at', { ascending: false })
    .limit(3);
  const { data: identities } = await supabase.auth.getUserIdentities();
  const providers = [...new Set((identities?.identities ?? []).map((i) => (i.provider === 'google' ? 'Google' : 'Email link')))];
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">Account</h1>
        <p className="mt-1 text-sm text-muted">Your details, your couple, and your data.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader title="You" action={<Link href="/app/setup" className="text-sm text-accent underline">Edit name or specialty</Link>} />
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr] [&_dd]:font-medium">
          <dt className="text-muted">Name</dt>
          <dd>{ctx.profile.display_name || '—'}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{ctx.user.email}</dd>
          <dt className="text-muted">Specialty</dt>
          <dd>{ctx.specialty?.name ?? '—'}</dd>
          <dt className="text-muted">Sign-in</dt>
          <dd>{providers.length ? providers.join(', ') : 'Email link'}</dd>
        </dl>
        <form action="/auth/signout" method="post" className="mt-4">
          <button className="text-sm text-accent underline">Sign out</button>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Your couple"
          action={ctx.couple ? <Badge tone={ctx.couple.status === 'active' ? 'accent' : 'warn'}>{ctx.couple.status === 'active' ? 'Linked' : 'Waiting for partner'}</Badge> : null}
        />
        {ctx.couple ? (
          <div className="flex flex-col gap-4 text-sm">
            <p>
              {ctx.couple.match_type === 'main' ? 'Main Residency Match' : ctx.couple.match_name} {ctx.couple.match_year}
              {ctx.partner ? <> with <strong>{displayName(ctx.partner)}</strong></> : null}.
            </p>
            <LeaveCouple partnerName={ctx.partner ? displayName(ctx.partner) : null} purgeDays={PURGE_DAYS} />
          </div>
        ) : (
          <p className="text-sm text-muted">
            You’re not in a couple. <Link href="/app/setup" className="text-accent underline">Start one</Link>.
          </p>
        )}
        {ended?.length ? (
          <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
            {ended.map((c) => {
              const at = new Date(c.dissolved_at!);
              const purge = new Date(at.getTime() + PURGE_DAYS * 86400_000);
              return (
                <li key={c.id}>
                  A {c.match_year} couple ended on {fmt(at)}. Its lists are kept until {fmt(purge)}, then deleted.
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
      </div>

      <AppearanceCard />

      <Card>
        <CardHeader title="Your data" />
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          <li>Only you and your partner can see your lists, answers and versions.</li>
          <li>
            You can download your list as a spreadsheet or PDF from the <Link href="/app/list" className="text-accent underline">final list</Link>.
          </li>
          <li>
            Read the <Link href="/privacy" className="text-accent underline">privacy page</Link> for the details.
          </li>
        </ul>
      </Card>

      <Card tone="danger">
        <CardHeader title="Delete your account" />
        <DeleteAccount inCouple={!!ctx.couple} />
      </Card>
    </div>
  );
}
