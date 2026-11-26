import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { createClient } from '@/lib/supabase/server';

/**
 * Signs out, then goes home — or, given `next` (and optionally `email`), to sign-in with
 * that page to come back to: "Sign out and switch account" on an invite keeps the invite
 * (bug log #41).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const form = await request.formData().catch(() => null);
  const next = form?.get('next');
  let to = '/';
  if (typeof next === 'string' && next) {
    const params = new URLSearchParams({ next: safeNext(next) });
    const email = form?.get('email');
    if (typeof email === 'string' && /^[^@\s]+@[^@\s]+$/.test(email)) params.set('email', email);
    to = `/login?${params}`;
  }
  return NextResponse.redirect(new URL(to, request.nextUrl.origin), { status: 303 });
}
