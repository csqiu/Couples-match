'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { acceptInvite } from './actions';

export function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite.bind(null, token), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Joining…' : 'Accept and join'}</Button>
    </form>
  );
}
