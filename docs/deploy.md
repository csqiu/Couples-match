# Deploying Pairwise

The app is a standard Next.js app in `apps/web`, backed by the Supabase project that
is already live. Deploying it means putting the web app on Vercel and telling
Supabase where it lives. About 20 minutes, mostly clicking.

## What it costs

| Service | Free tier | When you'd pay |
|---|---|---|
| **Vercel** | Hobby plan: free, but *for non-commercial use only* | Pro is $20 per team member per month. A company launching a product should be on Pro. |
| **Supabase** | Free plan (what we use now): 500 MB database, 50,000 monthly users. **Paused after 7 days without activity.** | Pro is $25/month: no pausing, daily backups. Worth it before real users arrive. |
| **Resend** (invite emails) | 3,000 emails a month, 100 a day | Only at much larger volume. |
| **Map tiles** (OpenFreeMap) | Free, no account | — |

These figures are from published 2025 pricing and weren’t checked live; confirm on each site before deciding.

## 1. Vercel

1. In Vercel: **Add New → Project**, and import the GitHub repository `csqiu/couples-match`.
2. **Root Directory:** `apps/web`. Leave "Include files outside the root directory"
   switched **on**, because the app uses the shared packages in `packages/`.
3. Framework preset: **Next.js**. Leave the build and install commands as they are
   (pnpm is picked up automatically).
4. **Environment variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://julbfusuwcjptyobguxm.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Settings → API Keys → “Publishable and secret API keys” → the `default` publishable key (starts `sb_publishable_`). Not the legacy `anon` key. |
   | `APP_URL` | Your public address, e.g. `https://pairwise.app` (optional: without it the Vercel production address is used) |

   Do **not** set `PAIRWISE_DEV_LOGIN`. (The test sign-in is switched off in production
   builds anyway.)
5. **Deploy.** Note the address Vercel gives you.

## 2. Supabase: tell sign-in where the app lives

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** your public address (e.g. `https://pairwise.app`).
- **Redirect URLs:** add `https://pairwise.app/auth/callback`, and for preview
  deployments `https://*-<your-vercel-team>.vercel.app/auth/callback`.

Without this, sign-in links send people back to `localhost`.

## 3. Sign-in emails (important before real users)

Supabase's built-in email sender is for testing only: it sends just a few emails an
hour. Before launch, under **Authentication → Emails → SMTP Settings**, connect a real
sender. Resend works (smtp.resend.com, using a Resend API key as the password), once
your domain is verified in Resend.

## 4. Partner invite emails

The `send-invite` function is already deployed. It needs three secrets (Supabase
dashboard → **Edge Functions → Secrets**):

| Name | Value |
|---|---|
| `RESEND_API_KEY` | From resend.com, after verifying your domain |
| `INVITE_FROM_EMAIL` | e.g. `Pairwise <invites@pairwise.app>` |
| `APP_URL` | Your public address |

Until these are set, inviting still works: the app shows the invite link to copy and
send yourself.

## 5. Google sign-in (optional)

Create an OAuth client in Google Cloud (type "Web application"), with the redirect URI
Supabase shows under **Authentication → Providers → Google**. Paste the client id and
secret there and switch Google on.

## 6. Check it

- Open the site, sign in with a magic link, start a couple, invite a second address.
- Supabase → **Advisors** should show only the expected notices (see `DECISIONS.md`).
- Make yourself an admin (`profiles.is_admin = true`) and approve the seed programs at
  `/admin`.
