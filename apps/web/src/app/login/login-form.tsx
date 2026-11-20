'use client';
import { MailCheck } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { devSignIn, sendMagicLink, signInWithGoogle, type LoginState } from './actions';

export function LoginForm({ next, email, devLogin }: { next: string; email?: string; devLogin: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [devState, devAction, devPending] = useActionState<LoginState, FormData>(devSignIn, {});

  if (state.sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <MailCheck className="h-8 w-8 text-accent" aria-hidden />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted">
          We sent a sign-in link to <strong className="text-text">{state.sent}</strong>. It works once.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} placeholder="you@school.edu" />
        </Field>
        {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Email me a sign-in link'}</Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">Continue with Google</Button>
      </form>

      {devLogin ? (
        <form action={devAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4" data-testid="dev-login">
          <p className="text-xs font-medium text-warn">Development sign-in (disabled in production)</p>
          <input type="hidden" name="next" value={next} />
          <Input name="email" type="email" placeholder="test user email" aria-label="Test user email" required />
          <Input name="password" type="password" placeholder="password" aria-label="Test user password" required />
          {devState.error ? <p className="text-sm text-danger" role="alert">{devState.error}</p> : null}
          <Button type="submit" variant="secondary" disabled={devPending}>Sign in with password</Button>
        </form>
      ) : null}
    </div>
  );
}
