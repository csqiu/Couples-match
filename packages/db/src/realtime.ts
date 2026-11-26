/**
 * Live collaboration (spec Section 8): both partners see list edits, answers and
 * resolutions as they happen, plus presence ("Alex is answering comparisons").
 *
 * - Data changes arrive through Postgres Changes on the couple's tables; RLS
 *   decides who receives which rows, and we also filter by couple_id.
 * - Presence uses a private channel "couple:<id>"; the realtime.messages policy
 *   in the migrations lets only the couple's members join it.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const COUPLE_TABLES = [
  'couples',
  'individual_ranks',
  'comparisons',
  'pins',
  'pair_exclusions',
  'rule_exceptions',
  'list_versions',
  'rank_lists',
  'audit_events',
] as const;
export type CoupleTable = (typeof COUPLE_TABLES)[number];

export type Activity = 'browsing' | 'ranking' | 'answering' | 'resolving' | 'reviewing';

export interface PresenceState {
  userId: string;
  displayName: string;
  activity: Activity;
}

export interface CoupleChannelHandlers {
  /** Any change to the couple's data. Typically: refetch that table and re-run the engine. */
  onChange(table: CoupleTable, event: 'INSERT' | 'UPDATE' | 'DELETE', row: Record<string, unknown>): void;
  onPresence?(others: PresenceState[]): void;
  /** Connection status changes ('SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'), with the error if any. */
  onStatus?(status: string, error?: Error): void;
}

export function coupleChannelName(coupleId: string): string {
  return `couple:${coupleId}`;
}

/** Subscribes to a couple's changes and presence. Call `.unsubscribe()` on the result to leave. */
export function subscribeToCouple(
  supabase: SupabaseClient<Database>,
  coupleId: string,
  me: PresenceState,
  handlers: CoupleChannelHandlers,
): RealtimeChannel {
  const channel = supabase.channel(coupleChannelName(coupleId), {
    config: { private: true, presence: { key: me.userId } },
  });

  for (const table of COUPLE_TABLES) {
    const filter = table === 'couples' ? `id=eq.${coupleId}` : `couple_id=eq.${coupleId}`;
    channel.on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter },
      (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Record<string, unknown>; old: Record<string, unknown> }) =>
        handlers.onChange(table, payload.eventType, payload.eventType === 'DELETE' ? payload.old : payload.new),
    );
  }

  if (handlers.onPresence) {
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>();
      const others = Object.entries(state)
        .filter(([key]) => key !== me.userId)
        .map(([, metas]) => metas[metas.length - 1])
        .filter(Boolean) as PresenceState[];
      handlers.onPresence!(others);
    });
  }

  channel.subscribe(async (status, err) => {
    handlers.onStatus?.(status, err);
    if (status === 'SUBSCRIBED') await channel.track(me);
  });
  return channel;
}

/** Update what I'm doing, e.g. when moving to the comparison step. */
export function setActivity(channel: RealtimeChannel, me: PresenceState, activity: Activity) {
  return channel.track({ ...me, activity });
}
