import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { Live } from '@/components/live';
import { ProgressRail } from '@/components/progress-rail';
import { ThemeToggle } from '@/components/theme-toggle';
import { displayName, requireContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { count } = ctx.couple
    ? await supabase
        .from('individual_ranks')
        .select('program_id', { count: 'exact', head: true })
        .eq('couple_id', ctx.couple.id)
        .eq('user_id', ctx.user.id)
    : { count: 0 };
  const setupDone = !!ctx.couple && !!ctx.profile.specialty;
  const done = [...(setupDone ? ['setup'] : []), ...((count ?? 0) > 0 ? ['programs', 'rank'] : [])];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/app" className="text-lg font-semibold">{BRAND.name}</Link>
        <div className="flex items-center gap-1">
          {ctx.couple ? (
            <Live coupleId={ctx.couple.id} me={{ userId: ctx.user.id, displayName: displayName(ctx.profile, 'Your partner') }} />
          ) : null}
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <ProgressRail done={done} locked={!setupDone} />
      <main className="pb-12">{children}</main>
    </div>
  );
}
