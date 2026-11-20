import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BRAND } from '@/brand';
import { Card } from '@/components/ui/card';
import { getContext } from '@/lib/context';
import { DEV_LOGIN_ENABLED } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const { next = '/app', email, error } = await searchParams;
  if (await getContext()) redirect(next.startsWith('/') ? next : '/app');
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <Link href="/" className="text-lg font-semibold">{BRAND.name}</Link>
      <Card>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">No passwords — we email you a link.</p>
        {error ? <p className="mb-4 text-sm text-danger" role="alert">That sign-in link didn’t work. Request a new one.</p> : null}
        <LoginForm next={next} email={email} devLogin={DEV_LOGIN_ENABLED} />
      </Card>
    </main>
  );
}
