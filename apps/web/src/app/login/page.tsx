import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/logo';
import { MergeBackdrop } from '@/components/merge-backdrop';
import { Card } from '@/components/ui/card';
import { getContext } from '@/lib/context';
import { DEV_LOGIN_ENABLED } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const { next = '/app', email, error } = await searchParams;
  if (await getContext()) redirect(next.startsWith('/') ? next : '/app');
  return (
    <>
    <MergeBackdrop />
    <main id="main" tabIndex={-1} className="relative z-10 mx-auto flex max-w-md flex-col gap-6 px-4 py-12 outline-none">
      <Logo className="self-center" />
      <Card tone="strong" className="p-6 sm:p-[30px]">
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">No passwords: we email you a link. New here? The same link creates your account.</p>
        {error ? <p className="mb-4 text-sm text-danger" role="alert">That sign-in link didn’t work. Request a new one.</p> : null}
        <LoginForm next={next} email={email} devLogin={DEV_LOGIN_ENABLED} />
      </Card>
    </main>
    </>
  );
}
