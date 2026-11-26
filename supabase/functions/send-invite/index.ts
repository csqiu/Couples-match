// Supabase Edge Function (Deno): creates a partner invite and emails the link.
//
// The caller (partner A) is authenticated by their JWT. The invite token is
// created by the `create_invite` database function *as the caller* (so all of
// its checks apply) and is only ever sent by email — never returned to the
// browser.
//
// POST { coupleId: string, email: string }  →  { inviteId, expiresAt }
//
// Secrets (set with `supabase secrets set`): RESEND_API_KEY, INVITE_FROM_EMAIL, APP_URL.
// SUPABASE_URL and SUPABASE_PUBLISHABLE_KEYS (JSON, by key name) are provided by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { inviteHtml, inviteSubject, inviteText } from './email.ts';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'not_signed_in' });
  if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('INVITE_FROM_EMAIL') || !Deno.env.get('APP_URL')) {
    return json(503, { error: 'email_not_configured' });
  }

  let body: { coupleId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  if (!body.coupleId || !body.email) return json(400, { error: 'coupleId_and_email_required' });

  // A client that acts as the caller, so RLS and the function's own checks apply.
  const publishableKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default as string;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('create_invite', { p_couple: body.coupleId, p_email: body.email });
  if (error || !data?.[0]) return json(400, { error: error?.message ?? 'invite_failed' });
  const { invite_id: inviteId, token, expires_at: expiresAt } = data[0];

  const { data: me } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', me.user!.id).single();
  const inviterName = profile?.display_name ?? 'Your partner';
  const to = body.email.trim().toLowerCase();
  const appUrl = Deno.env.get('APP_URL')!;
  const email = { inviterName, email: to, link: `${appUrl}/invite/${token}`, appUrl };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('INVITE_FROM_EMAIL'),
      to: [to],
      subject: inviteSubject(inviterName),
      html: inviteHtml(email),
      text: inviteText(email),
    }),
  });
  if (!res.ok) {
    // Don't leave a live link nobody received.
    await supabase.rpc('revoke_invite', { p_invite: inviteId });
    return json(502, { error: 'email_failed' });
  }
  return json(200, { inviteId, expiresAt });
});
