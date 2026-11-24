import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/brand';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { AcceptForm } from './accept-form';

export const metadata: Metadata = { title: 'You’re invited' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, ctx] = await Promise.all([supabase.rpc('invite_preview', { p_token: token }), getContext()]);
  const invite = data?.[0];

  let body;
  if (!invite || invite.status !== 'valid') {
    const why = invite?.status === 'expired' ? 'has expired' : invite?.status === 'accepted' ? 'has already been used' : 'isn’t valid anymore';
    body = <p className="text-sm text-muted">This invite link {why}. Ask your partner to send a new one from their setup page.</p>;
  } else {
    const match = invite.match_type === 'main' ? 'the Main Residency Match' : `the ${invite.match_name} match`;
    const signedInAs = ctx?.user.email.toLowerCase();
    body = (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted">
          <strong className="text-text">{invite.inviter_name}</strong> invited you to build your Couples Match list together for{' '}
          {match}, {invite.match_year}.
        </p>
        {!ctx ? (
          <Link
            className={buttonVariants()}
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invite.invited_email)}`}
          >
            Sign in as {invite.invited_email}
          </Link>
        ) : signedInAs !== invite.invited_email.toLowerCase() ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-danger">
              You’re signed in as {ctx.user.email}, but this invite is for {invite.invited_email}.
            </p>
            <form action="/auth/signout" method="post">
              <button className={buttonVariants({ variant: 'secondary' })}>Sign out and switch account</button>
            </form>
          </div>
        ) : (
          <AcceptForm token={token} />
        )}
      </div>
    );
  }

  return (
    <main id="main" tabIndex={-1} className="outline-none mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <Link href="/" className="text-lg font-semibold">{BRAND.name}</Link>
      <Card>
        <h1 className="mb-3 text-xl font-semibold">You’re invited</h1>
        {body}
      </Card>
    </main>
  );
}
