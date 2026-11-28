import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { createClient } from '@/lib/supabase/server';
import { isBetaFull } from '@/lib/beta';

/** Lands magic links (PKCE code or token hash) and Google sign-in, then continues to `next`. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  // Google sign-in for a new account while the beta is full comes back with an error instead of a code.
  if (isBetaFull(url.searchParams.get('error_description'))) {
    return NextResponse.redirect(new URL('/login?error=full', url.origin));
  }
  const supabase = await createClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('missing code') };

  return NextResponse.redirect(new URL(error ? '/login?error=link' : next, url.origin));
}
