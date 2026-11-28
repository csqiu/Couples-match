/**
 * The activity feed: audit events in plain English, with bursts (an autosave
 * every few seconds while someone drags) folded into one line. Pure, so it's
 * unit-tested.
 */
import type { AuditEventRow } from '@pairwise/db';

export type ActivityEvent = Pick<AuditEventRow, 'id' | 'user_id' | 'type' | 'payload' | 'created_at'>;

export interface ActivityItem {
  key: string;
  /** null when the person no longer has an account, or an admin made the change. */
  who: string;
  text: string;
  at: string;
  /** How many raw events this line stands for. */
  events: number;
}

/** Events by the same person, of the same kind, this close together become one line. */
export const MERGE_WINDOW_MS = 30 * 60 * 1000;

const SETTING_LABEL: Record<string, string> = {
  privacy: 'tier privacy',
  answerMode: 'how you answer comparisons',
  distanceBands: 'the distance bands',
  balance: 'the balance between you',
  listLength: 'the list length',
  tierARule: 'the Tier A rule',
  tierAPriority: 'Tier A priority',
  noMatchAtBottom: 'the No Match rule',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function describe(type: string, count: number, payload: Record<string, unknown>, you: boolean): string {
  const their = you ? 'your' : 'their';
  switch (type) {
    case 'individual_ranks.insert':
      return `added ${plural(count, 'program')} to ${their} list`;
    case 'individual_ranks.update':
      return `reordered or edited ${their} list (${plural(count, 'change')})`;
    case 'individual_ranks.delete':
      return `removed ${plural(count, 'program')} from ${their} list`;
    case 'comparisons.insert':
      return `answered ${plural(count, '“this or that” question')}`;
    case 'comparisons.delete':
      return `took back ${plural(count, 'answer')}`;
    case 'comparisons.update':
      return `updated ${plural(count, 'answer')}`;
    case 'pins.insert':
      return `fixed the order of ${plural(count, 'pair')}`;
    case 'pins.delete':
      return `unfixed ${plural(count, 'pair')}`;
    case 'pair_exclusions.insert':
      return `ruled out ${plural(count, 'pair')}`;
    case 'pair_exclusions.delete':
      return `brought back ${plural(count, 'ruled-out pair')}`;
    case 'rule_exceptions.insert':
      return `resolved ${plural(count, 'conflict')}`;
    case 'rule_exceptions.delete':
      return `reopened ${plural(count, 'conflict')}`;
    case 'list_versions.insert':
      return count === 1 ? 'saved a version of the list' : `saved ${count} versions of the list`;
    case 'list_versions.update':
      return `renamed or starred ${count === 1 ? 'a version' : `${count} versions`}`;
    case 'rank_lists.started':
      return `started List ${String(payload.number ?? '')}`;
    case 'rank_lists.opened':
      return `opened List ${String(payload.number ?? '')}`;
    case 'list_versions.delete':
      return `deleted ${count === 1 ? 'a version' : `${count} versions`}`;
    case 'list_versions.restored':
      return `restored the version “${String(payload.name ?? 'untitled')}”`;
    case 'admin.merge':
      return 'merged a duplicate program into the listed one; your lists and answers moved across';
    case 'invites.insert':
      return 'sent a partner invite';
    case 'invites.update':
      return 'updated the partner invite';
    case 'invites.delete':
      return 'removed a partner invite';
    case 'couples.settings': {
      const keys = (Array.isArray(payload.changed) ? payload.changed : []) as string[];
      const named = [...new Set(keys.map((k) => SETTING_LABEL[k] ?? 'other settings'))];
      return named.length ? `changed ${joinWords(named)}` : 'changed the settings';
    }
    case 'couples.active':
      return 'joined, so the couple is linked';
    case 'couples.dissolved':
      return 'left the couple. Your data is read-only and will be deleted after 30 days';
    default:
      return `made a change (${type})`;
  }
}

function joinWords(xs: string[]) {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
}

/** Newest first. `names` maps user ids to display names. */
export function describeActivity(events: ActivityEvent[], names: Record<string, string>): ActivityItem[] {
  const sorted = [...events].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const items: Array<ActivityItem & { type: string; userId: string | null; count: number; oldest: number; payload: Record<string, unknown> }> = [];
  for (const raw of sorted) {
    // Only an admin (merging duplicate programs) changes a couple's rows without being in it.
    const e = raw.user_id && !names[raw.user_id] ? { ...raw, type: 'admin.merge' } : raw;
    const count = Number((e.payload as Record<string, unknown>)?.count ?? 1) || 1;
    const t = Date.parse(e.created_at);
    const last = items.at(-1);
    // Settings and one-off events (restore, link, leave) stay on their own line.
    const mergeable = !e.type.startsWith('couples.') && e.type !== 'list_versions.restored';
    if (last && mergeable && last.type === e.type && last.userId === e.user_id && last.oldest - t <= MERGE_WINDOW_MS) {
      last.count += count;
      last.events += 1;
      last.oldest = t;
      continue;
    }
    items.push({
      key: String(e.id),
      who: e.user_id ? (names[e.user_id] ?? 'An admin') : 'Someone',
      text: '',
      at: e.created_at,
      events: 1,
      type: e.type,
      userId: e.user_id,
      count,
      oldest: t,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    });
  }
  return items.map(({ key, who, at, events, type, count, payload }) => ({ key, who, at, events, text: describe(type, count, payload, who === 'You') }));
}
