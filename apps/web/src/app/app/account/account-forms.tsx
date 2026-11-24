'use client';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { deleteAccount, leaveCouple } from './actions';

export function LeaveCouple({ partnerName, purgeDays }: { partnerName: string | null; purgeDays: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  if (!confirming) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setConfirming(true)}>
        Leave this couple
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-warn-soft p-3" role="alert">
      <p className="font-medium">Leave the couple?</p>
      <ul className="list-disc pl-5 text-muted">
        <li>{partnerName ? `You and ${partnerName}` : 'You'} will no longer be able to edit the shared list.</li>
        <li>The couple’s lists, answers and versions are deleted after {purgeDays} days.</li>
        <li>Download a PDF or CSV from the final list first if you want a copy.</li>
        <li>You can then start a new couple.</li>
      </ul>
      {error ? <p className="text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await leaveCouple();
              if (res.error) setError(res.error);
              else router.push('/app/setup');
            })
          }
        >
          {busy ? 'Leaving…' : 'Yes, leave the couple'}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function DeleteAccount({ inCouple }: { inCouple: boolean }) {
  const id = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await deleteAccount(text);
          if (res.error) setError(res.error);
          else window.location.assign('/?deleted=1');
        });
      }}
    >
      <p className="text-muted">
        This permanently deletes your profile, your rank list and your answers, right away. It can’t be undone.
        {inCouple ? ' Your couple ends, and your partner keeps their own list.' : ''}
      </p>
      <Field label="Type DELETE to confirm" htmlFor={`${id}-confirm`}>
        <Input id={`${id}-confirm`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="sm:max-w-60" />
      </Field>
      {error ? <p className="text-danger" role="alert">{error}</p> : null}
      <Button type="submit" variant="danger" className="self-start" disabled={busy || text.trim().toLowerCase() !== 'delete'}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </Button>
    </form>
  );
}
