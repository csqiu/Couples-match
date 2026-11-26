'use client';
import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import type { ProgramSide } from '@/lib/pair-view';
import { cn } from '@/lib/cn';

/** Lists longer than this get a search box in the dropdown. */
export const SEARCH_FROM = 16;

const ROW_TINT = { A: 'bg-accent-soft', B: 'bg-partner-2-soft', C: 'bg-surface-2' } as const;
const TIER_CHIP = {
  A: 'bg-tier-a text-tier-a-fg',
  B: 'border border-tier-b/30 bg-partner-2-soft text-tier-b',
  C: 'border-[1.5px] border-border text-tier-c',
} as const;

function TierChip({ tier }: { tier: 'A' | 'B' | 'C' }) {
  return <span className={cn('inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold', TIER_CHIP[tier])}>Tier {tier}</span>;
}

/**
 * One program slot in a specific comparison: shows the chosen program, and opens the
 * partner's rank list (numbered, shaded by tier, No Match last) to pick another.
 * `value` is a program id, 'NO_MATCH', or null while nothing is chosen.
 */
export function ProgramPlate({
  name,
  slot,
  programs,
  value,
  onChange,
  showTiers,
}: {
  name: string;
  slot: 1 | 2;
  /** This partner's rank list, best first. */
  programs: ProgramSide[];
  value: string | null;
  onChange: (id: string) => void;
  /** False when this partner's tiers are private to me. */
  showTiers: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const chosen = value === 'NO_MATCH' ? 'none' : programs.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = programs.filter((p) => words.every((w) => `${p.name} ${p.short} ${p.place}`.toLowerCase().includes(w)));
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };
  const partnerText = slot === 1 ? 'text-accent' : 'text-plum-deep';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        data-testid={`plate-${slot}`}
        className={cn(
          'flex min-h-16 w-full items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left transition-colors duration-150',
          chosen ? 'border border-border bg-glass-row hover:bg-glass-strong' : 'border-2 border-dashed border-border hover:bg-glass-strong',
          open && 'outline-2 outline-offset-2 outline-action',
        )}
      >
        <Avatar name={name} slot={slot} />
        {chosen === null ? (
          <span className="flex-1 font-medium text-muted">Choose {name}’s program</span>
        ) : chosen === 'none' ? (
          <span className="flex flex-1 flex-col">
            <span className={cn('eyebrow', partnerText)}>{name}</span>
            <span className="font-display text-[17px] font-semibold text-warn">No Match</span>
          </span>
        ) : (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('eyebrow', partnerText)}>{name}{chosen.rank ? ` · #${chosen.rank}` : ''}</span>
              <span className="font-display text-[17px] leading-snug font-semibold" title={chosen.name}>{chosen.short}</span>
              <span className="text-[13px] text-muted">{chosen.place}</span>
            </span>
            {showTiers && chosen.tier ? <TierChip tier={chosen.tier} /> : null}
          </>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1.5 flex flex-col gap-1.5 rounded-[18px] border border-border bg-surface p-2 shadow-glass">
          <p className="eyebrow px-2 pt-1.5 text-muted">{name}’s rank list · {programs.length}</p>
          {programs.length >= SEARCH_FROM ? (
            <label className="relative block">
              <span className="sr-only">Search {name}’s programs</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by program or city"
                className="min-h-11 w-full rounded-[14px] border border-border bg-surface pr-3 pl-9 text-sm"
              />
            </label>
          ) : null}
          <ul id={listId} role="listbox" aria-label={`${name}’s rank list`} className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === value}
                  onClick={() => pick(p.id)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-[12px] border-2 px-2.5 py-1.5 text-left',
                    showTiers && p.tier ? ROW_TINT[p.tier] : 'bg-surface-2',
                    p.id === value ? 'border-action' : 'border-transparent hover:border-border',
                  )}
                >
                  <span className="w-9 shrink-0 text-right font-mono text-[13px] font-semibold tabular-nums text-plum-deep">{p.rank ? `#${p.rank}` : '–'}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold" title={p.name}>{p.short}</span>
                    <span className="truncate text-xs text-muted">{p.place}</span>
                  </span>
                  {showTiers && p.tier ? <TierChip tier={p.tier} /> : null}
                </button>
              </li>
            ))}
            {words.length && !shown.length ? <li className="px-2.5 py-1 text-xs text-muted">No programs match that search.</li> : null}
            <li className="mt-1">
              <button
                type="button"
                role="option"
                aria-selected={value === 'NO_MATCH'}
                onClick={() => pick('NO_MATCH')}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-[12px] border-2 bg-warn-soft px-2.5 py-1.5 text-left',
                  value === 'NO_MATCH' ? 'border-action' : 'border-transparent hover:border-border',
                )}
              >
                <span className="w-9 shrink-0 text-right font-mono text-[13px] text-muted">–</span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-warn">No Match</span>
                  <span className="text-xs text-muted">{name} doesn’t match this round</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
