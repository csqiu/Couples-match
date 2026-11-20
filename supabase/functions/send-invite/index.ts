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
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2.119.2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('create_invite', { p_couple: body.coupleId, p_email: body.email });
  if (error || !data?.[0]) return json(400, { error: error?.message ?? 'invite_failed' });
  const { invite_id: inviteId, token, expires_at: expiresAt } = data[0];

  const { data: me } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', me.user!.id).single();
  const inviter = escapeHtml(profile?.display_name ?? 'Your partner');
  const link = `${Deno.env.get('APP_URL')}/invite/${token}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('INVITE_FROM_EMAIL'),
      to: [body.email.trim().toLowerCase()],
      subject: `${profile?.display_name ?? 'Your partner'} invited you to plan your Couples Match list`,
      html: `<p>${inviter} invited you to build your NRMP Couples Match rank list together.</p>
<p><a href="${link}">Accept the invite</a> — sign in with this email address. The link works once and expires in 7 days.</p>
<p style="color:#666;font-size:12px">This app is a planning tool and is not affiliated with the NRMP.</p>`,
    }),
  });
  if (!res.ok) {
    // Don't leave a live link nobody received.
    await supabase.rpc('revoke_invite', { p_invite: inviteId });
    return json(502, { error: 'email_failed' });
  }
  return json(200, { inviteId, expiresAt });
});
