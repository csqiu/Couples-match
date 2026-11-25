# Pairwise: project summary (context for a chat with Claude)

## What it is

**Pairwise** is my web app (working name) for two people applying to residency together
through the **NRMP Couples Match**. It turns each partner's honest preferences into a
ready-to-enter rank list of **program pairs** (my program + my partner's program).

The key idea: the NRMP algorithm reads a couple's list top-down and gives them the highest
pair that works out, so **the best list is simply the couple's true order of preference**.
Pairwise doesn't predict odds or try to game the Match. It helps a couple work out and
write down what they actually want, especially the trade-off between **being close
together** and **each getting the programs they like most**.

It's a planning tool, not affiliated with NRMP. Couples still type and certify their list
in NRMP's R3 system themselves.

- Live at https://couples-match-ranker.vercel.app
- All 9 build phases are done; I'm now fixing bugs from a bug log.

## How a couple uses it

1. **Setup and invite.** Sign in by magic link (or Google). Partner 1 invites Partner 2 by
   email (single-use link, expires in 7 days). One couple per person per match year; both
   must be in the same NRMP match.
2. **Programs.** Each partner searches and adds programs (with a map). The database has the
   full 2027 NRMP Main Match directory: 7,096 program tracks in 49 specialties, with
   official NRMP codes. Couples can add a program that isn't listed; an admin reviews it.
3. **Rank and tier.** Each partner orders their own programs and sorts them into tiers:
   - **A**: "I'd take this over any lower program, wherever my partner lands."
   - **B**: "Strong preference, but I'd trade down to be with my partner."
   - **C**: "Acceptable fallback."
4. **"This or that" comparisons.** e.g. "Both at your #1 programs on opposite coasts, or
   both at your #4 programs in the same city?" The answers teach the app how much distance
   matters to this couple.
5. **Conflicts.** If answers contradict each other (go in a circle, or two Tier A rules
   can't both hold), it explains why in plain language and asks the couple to decide.
6. **Final list.** Editable (drag and drop), colour-coded by how close each pair is, saved
   as versions, exported as a checklist, PDF and CSV for typing into R3. Also: a map of
   every pair, an activity feed of who changed what, and an account page.

Both partners see each other's edits live.

## How the engine ranks pairs

**Hard rules (never broken):**
- **Dominance / common sense:** if pair X is at least as good for both partners and no
  farther apart than pair Y, X goes above Y.
- **Tier A rule** (each partner can toggle it): any pair giving me a Tier A program while my
  partner matches somewhere goes above every pair that doesn't.
- **No Match goes last** (per NRMP guidance; can be turned off with a warning). No Match
  rows end the list in a fixed order.
- **Things the couple said for certain:** "I'm certain" answers, manual drags, and conflict
  resolutions.

**A score for everything else:** each program is worth points to each partner based on tier
and position; being apart costs points (commutable a little, drivable more, apart most;
"apart" is a flat cost regardless of miles).

**Learning:** the engine keeps ~2,000 plausible guesses about the couple's trade-offs and
reweights them with each answer (a Bayesian-style approach), so it knows how sure it is.
It uses that to:
- pick the most informative next question (5 standard calibration questions first),
- skip "moot" questions whose answer can't change the Match outcome,
- suggest stopping when "list confidence" reaches 90% (or after 40 questions),
- flag old answers that no longer fit ("Still true?") without deleting them.

It can explain **why** any row is above another.

**Benchmark** (12 simulated couples, 40 questions each, 10% deliberately wrong answers,
agreement with the true order over the top 100 pairs, 1.0 = identical): about 0.84 before
any questions, about 0.96–0.97 after 40 with smart question choice, versus about 0.91 with
random questions.

## Tech stack

- **Monorepo** (pnpm, TypeScript):
  - `apps/web`: Next.js 16 / React 19, Tailwind 4, MapLibre maps, dnd-kit drag and drop
  - `packages/engine`: scoring, hard rules as a graph, conflict detection, ranking,
    learning, question choice (the "brain")
  - `packages/data`: specialties, NRMP directory import, geocoding (US Census then
    OpenStreetMap), metro areas (CBSA)
  - `packages/db`: database types, rows to engine input, live sync
- **Supabase** (Postgres + PostGIS) for auth, data, row-level security (only the two
  partners can see a couple's data; each edits only their own list), realtime sync, and an
  invite-email function.
- **Vercel** for hosting.
- Tests: engine unit tests, database tests, Playwright end-to-end (two partners plus an
  admin), automated accessibility checks (WCAG 2.1 AA, light and dark).

## Other details

- **Admin area:** review queue for possible duplicates (merge keeps every couple's places
  and answers), couple-added programs, and doubtful map locations; CSV import of up to 300
  programs with a preview.
- **Privacy:** leaving a couple makes it read-only, deleted after 30 days; deleting an
  account removes data immediately. Each person's program list belongs to them and comes
  back automatically in their next couple.
- **Locations** are city centres (the NRMP directory has no street addresses), except
  hospitals that were in my original hand-entered seed list.
- Design decisions are logged in `DECISIONS.md` in the repo (116 numbered decisions so far).
