import { BookOpen, CircleUser, History } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { HeaderLink } from '@/components/header-link';
import { Live } from '@/components/live';
import { Logo } from '@/components/logo';
import { ProgressRail } from '@/components/progress-rail';
import { ThemeToggle } from '@/components/theme-toggle';
import { displayName, requireContext } from '@/lib/context';
import { versionLabel } from '@/lib/lists';
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
  const { count: answers } = ctx.couple
    ? await supabase.from('comparisons').select('id', { count: 'exact', head: true }).eq('couple_id', ctx.couple.id)
    : { count: 0 };
  const { data: lastVersion } = ctx.list
    ? await supabase.from('list_versions').select('minor').eq('list_id', ctx.list.id).order('minor', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const setupDone = !!ctx.couple && !!ctx.profile.specialty;
  const done = [
    ...(setupDone ? ['setup'] : []),
    ...((count ?? 0) > 0 ? ['programs', 'rank'] : []),
    ...(lastVersion ? ['list'] : []),
    // The calibration questions are done: a reasonable point to call this step started in earnest.
    ...((answers ?? 0) >= 5 ? ['compare'] : []),
  ];

  return (
    <AppShell>
      <header className="flex items-center justify-between gap-3">
        <Logo href="/app" />
        <div className="flex items-center gap-1">
          {ctx.couple ? (
            <Live coupleId={ctx.couple.id} partnerSlot={ctx.role === 'b' ? 1 : 2} me={{ userId: ctx.user.id, displayName: displayName(ctx.profile, 'Your partner') }} />
          ) : null}
          {ctx.profile.is_admin ? (
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-[14px] px-3 text-sm text-muted hover:bg-glass hover:text-text">
              Admin
            </Link>
          ) : null}
          {ctx.couple ? (
            <HeaderLink href="/app/activity" label="Activity">
              <History className="h-5 w-5" aria-hidden />
            </HeaderLink>
          ) : null}
          <Link
            href="/guides"
            title="Guides"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[14px] border border-transparent px-2.5 text-sm text-muted transition-colors duration-150 hover:border-glass-border hover:bg-glass hover:text-text"
          >
            <BookOpen className="h-5 w-5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Guides</span>
          </Link>
          <ThemeToggle />
          <HeaderLink href="/app/account" label="Account">
            <CircleUser className="h-5 w-5" aria-hidden />
          </HeaderLink>
        </div>
      </header>
      <ProgressRail
        done={done}
        locked={!setupDone}
        list={ctx.list ? { number: ctx.list.number, name: ctx.list.name, lastSaved: lastVersion ? versionLabel(ctx.list.number, lastVersion.minor) : null } : null}
      />
      <main id="main" tabIndex={-1} className="min-w-0 pb-12 outline-none">{children}</main>
    </AppShell>
  );
}
