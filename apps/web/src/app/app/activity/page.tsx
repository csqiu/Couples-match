import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { describeActivity } from '@/lib/activity';
import { displayName, requireCouple } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';
import { RelativeTime } from './relative-time';

export const metadata: Metadata = { title: 'Activity' };

const LIMIT = 500;

export default async function ActivityPage() {
  const ctx = await requireCouple();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('audit_events')
    .select('id, user_id, type, payload, created_at')
    .eq('couple_id', ctx.couple.id)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  const partnerId = ctx.role === 'a' ? ctx.couple.partner_b : ctx.couple.partner_a;
  const names: Record<string, string> = { [ctx.user.id]: 'You' };
  if (partnerId) names[partnerId] = displayName(ctx.partner);
  const items = describeActivity(events ?? [], names);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">Activity</h1>
        <p className="mt-1 text-sm text-muted">What each of you has changed, newest first. Bursts of edits are grouped into one line.</p>
      </div>
      {items.length ? (
        <Card tone="strong" className="max-w-3xl p-2 sm:p-2">
          <ol className="flex flex-col gap-1.5" aria-label="Activity">
            {items.map((i) => (
              <li key={i.key} className="glass-row flex flex-col gap-0.5 px-3.5 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span>
                  <strong className="font-medium">{i.who}</strong> {i.text}
                </span>
                <RelativeTime iso={i.at} className="shrink-0 font-mono text-xs text-muted" />
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <div className="glass border-dashed p-10 text-center text-sm text-muted">
          Nothing yet. Changes either of you makes will show up here.
        </div>
      )}
      {(events?.length ?? 0) >= LIMIT ? <p className="text-xs text-muted">Showing the most recent {LIMIT} changes.</p> : null}
    </div>
  );
}
