'use client';
import { Plus, Star, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import type { ListStep } from '@/lib/lists';
import { openList, setStar, startList } from './dashboard-actions';

export function StarButton({ id, label, starred }: { id: string; label: string; starred: boolean }) {
  const [on, setOn] = useState(starred);
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => setOn(starred), [starred]);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Unstar version ${label}` : `Star version ${label}`}
      title={on ? 'Starred' : 'Star this version'}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await setStar(id, next);
          if (res.error) {
            setOn(!next);
            toast({ message: res.error });
          }
        });
      }}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] transition-colors duration-150 hover:bg-glass-strong',
        on ? 'text-warn' : 'text-muted hover:text-text',
      )}
    >
      <Star className="h-5 w-5" fill={on ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}

/**
 * Opens a list that isn't the open one. Both partners work in the same list, so
 * when there is a partner this asks first.
 */
export function OpenListButton({
  listId,
  listNumber,
  step,
  partner,
  className,
  children,
}: {
  listId: string;
  listNumber: number;
  step: ListStep;
  partner: string | null;
  className?: string;
  children: ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const go = () =>
    start(async () => {
      const res = await openList(listId, step);
      if (res?.error) toast({ message: res.error });
    });
  if (confirming) {
    return (
      <div role="group" aria-label={`Open List ${listNumber}`} className="flex flex-wrap items-center gap-2 rounded-[16px] bg-warn-soft px-3 py-2 text-[13.5px]">
        <span>{partner} will be moved to List {listNumber} too.</span>
        <Button size="sm" onClick={go} disabled={pending}>{pending ? 'Opening…' : `Open List ${listNumber}`}</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    );
  }
  return (
    <button type="button" className={className} disabled={pending} onClick={() => (partner ? setConfirming(true) : go())}>
      {children}
    </button>
  );
}

export interface VersionOption {
  id: string;
  label: string;
  name: string;
}

export function NewListDialog({ nextNumber, versions, partner }: { nextNumber: number; versions: VersionOption[]; partner: string | null }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<'blank' | 'copy'>('blank');
  const [version, setVersion] = useState(versions[0]?.id ?? '');
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="start-list">
        <Plus className="h-4 w-4" aria-hidden /> Start a new list
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-[24px] border border-border bg-surface p-0 text-text shadow-glass backdrop:bg-text/30"
      >
        <form
          className="flex flex-col gap-5 p-6 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await startList(name, from === 'copy' ? version : null);
              if (res?.error) toast({ message: res.error });
            });
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-muted">New start · List {nextNumber}</p>
              <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold tracking-[-0.01em]">Start a new list</h2>
              <p className="mt-1 text-sm text-muted">
                You both rank again from the start. Your other lists and their versions stay exactly as they are.
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] text-muted hover:bg-surface-2">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Name (optional)
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. After second looks" />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Start the Rank step from</legend>
            <Choice checked={from === 'blank'} onSelect={() => setFrom('blank')} title="Blank tiers">
              Every program starts in Tier B, in your current order. Best when your views have changed a lot.
            </Choice>
            <Choice checked={from === 'copy'} onSelect={() => setFrom('copy')} title="A saved version’s tiers" disabled={!versions.length}>
              {versions.length ? 'Start with the tiers you had in a saved version, then change what you like.' : 'Save a version first to use this.'}
            </Choice>
            {from === 'copy' && versions.length ? (
              <label className="flex flex-col gap-1.5 pl-9 text-[13.5px] text-muted">
                Copy from
                <Select value={version} onChange={(e) => setVersion(e.target.value)} className="max-w-xs font-mono">
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {v.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
          </fieldset>

          <div className="rounded-[16px] bg-surface-2 px-4 py-3 text-[13.5px]">
            <p className="font-semibold">What carries over</p>
            <p className="text-muted">
              Your program lists, notes and NRMP codes. Not carried over: “this or that” answers, conflict choices and final-list settings.
              {partner ? ` ${partner} moves to List ${nextNumber} with you.` : ''}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Starting…' : `Start List ${nextNumber}`}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Choice({ checked, onSelect, title, disabled, children }: { checked: boolean; onSelect: () => void; title: string; disabled?: boolean; children: ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-[16px] border-[1.5px] px-4 py-3.5',
        checked ? 'border-action bg-action-soft' : 'border-border bg-surface',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input type="radio" name="from" checked={checked} onChange={onSelect} disabled={disabled} className="mt-1 h-[18px] w-[18px] accent-[var(--action)]" />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-[13.5px] text-muted">{children}</span>
      </span>
    </label>
  );
}

