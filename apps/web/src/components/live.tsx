'use client';
import { setActivity, subscribeToCouple, type Activity, type PresenceState } from '@pairwise/db';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { browserClient } from '@/lib/supabase/client';

const ACTIVITY_BY_PATH: Array<[string, Activity]> = [
  ['/app/programs', 'browsing'],
  ['/app/rank', 'ranking'],
  ['/app/compare', 'answering'],
  ['/app/conflicts', 'resolving'],
  ['/app/list', 'reviewing'],
];
const LABEL: Record<Activity, string> = {
  browsing: 'is looking at programs',
  ranking: 'is ranking',
  answering: 'is answering comparisons',
  resolving: 'is resolving conflicts',
  reviewing: 'is reviewing the list',
};

/**
 * Keeps the page in sync with the partner: refreshes server data when the
 * couple's rows change, and shows what the partner is doing right now.
 */
export function Live({ coupleId, me, partnerSlot }: { coupleId: string; me: { userId: string; displayName: string }; partnerSlot: 1 | 2 }) {
  const router = useRouter();
  const pathname = usePathname();
  const [others, setOthers] = useState<PresenceState[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activity = ACTIVITY_BY_PATH.find(([p]) => pathname.startsWith(p))?.[1] ?? 'browsing';
  // One channel for the whole visit; moving between pages only updates what I'm doing, so the
  // partner's indicator doesn't drop out and come back on every page change (bug log #42).
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const channelRef = useRef<ReturnType<typeof subscribeToCouple> | null>(null);
  const subscribed = useRef(false);

  useEffect(() => {
    const supabase = browserClient();
    let channel: ReturnType<typeof subscribeToCouple> | null = null;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = subscribeToCouple(
        supabase,
        coupleId,
        () => ({ ...me, activity: activityRef.current }),
        {
          onChange: () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => router.refresh(), 400);
          },
          onPresence: setOthers,
          onStatus: (status, err) => {
            subscribed.current = status === 'SUBSCRIBED';
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn(`[live] ${status}`, err?.message ?? '');
          },
        },
      );
      channelRef.current = channel;
    })();
    return () => {
      cancelled = true;
      channelRef.current = null;
      subscribed.current = false;
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, me.userId, me.displayName, router]);

  useEffect(() => {
    const channel = channelRef.current;
    if (channel && subscribed.current) void setActivity(channel, { ...me, activity }, activity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  const partner = others[0];
  if (!partner) return null;
  return (
    <p className="glass flex min-h-9 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs text-muted" title={`${partner.displayName} ${LABEL[partner.activity] ?? 'is here'}`} aria-live="polite">
      <Avatar name={partner.displayName} slot={partnerSlot} size="sm" className="h-6 w-6" />
      <span className="sr-only whitespace-nowrap sm:not-sr-only">
        <span className="font-medium text-text">{partner.displayName}</span> {LABEL[partner.activity] ?? 'is here'}
      </span>
      <span className="h-2 w-2 rounded-full bg-band-together shadow-[0_0_0_3px_color-mix(in_srgb,var(--band-together)_18%,transparent)]" aria-hidden />
    </p>
  );
}
