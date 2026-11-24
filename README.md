# Pairwise

*(Working name. Branding will live in a single config file once the web app exists.)*

Pairwise helps two people applying to residency (or fellowship) together through the
**NRMP Couples Match** turn their honest preferences into a ready-to-enter list of
program pairs.

The NRMP algorithm reads a couple's list from the top down and gives them the highest
pair that works out. That means **the best list is simply your true order of
preference**. Pairwise doesn't try to predict your odds or "game" the match. It helps
you figure out and write down what you actually want, especially the hard trade-off
between being close together and getting the programs each of you likes most.

> Pairwise is a planning tool. It is not affiliated with the NRMP. You must enter and
> certify your list in NRMP's R3 system yourselves.

## What it does (when finished)

1. **Each of you ranks your own programs** and sorts them into tiers:
   - **A**: "I'd take this over any lower program, wherever my partner lands."
   - **B**: "Strong preference, but I'd trade down to be with my partner."
   - **C**: "Acceptable fallback."
2. **Pairwise builds every possible pair** (your program + your partner's program, plus
   "No Match" for either of you) and works out how far apart each pair is.
3. **You answer a few "this or that" questions** ("Both at your #1 programs but on
   opposite coasts, or both at your #4 programs in the same city?"). That teaches it how
   much distance matters to you.
4. **It catches contradictions.** If your answers go in a circle, or both of your Tier A
   programs can't come first, it shows you why in plain language and asks you to decide.
5. **You get an editable final list.** It is colour-coded by how close together each
   pair is, can be saved as versions, and exports to a checklist, PDF and CSV for typing
   into R3. A **map** shows every pair in the list as a line between the two programs.
6. **Activity and account.** An activity feed shows what each of you changed. The account
   page lets you leave a couple or delete your account.

## How the engine decides an order

The engine has two layers.

**1. Hard rules.** These can never be broken by the scoring:

- **Common sense ("dominance").** If pair X is at least as good for both of you as
  pair Y, and no farther apart, X goes above Y. Example: you both get your #1 program in
  the same city, versus you both get your #2 programs in that same city.
- **Tier A rule** (each partner can turn this on or off). Any pair that gives you a Tier
  A program, while your partner matches somewhere, goes above every pair that doesn't
  give you Tier A.
- **No Match goes last.** Every pair where you both match goes above every pair where one
  of you doesn't. This follows NRMP's guidance. You can turn it off, but you'll get a
  warning.
- **Things you told it for certain.** These are "I'm certain" answers, rows you dragged
  into place, and decisions you made while resolving a conflict.

**2. A score for everything else.** Each program is worth something to each of you,
based on its tier and where it sits in the tier. Being apart costs some points.
"Commutable" costs a little, "drivable" more, and "apart" most. Apart is a flat cost:
800 miles and 2,500 miles count the same. Your "this or that" answers tune those numbers
to you.

**How it learns from your answers.** The engine doesn't keep one guess about how much
distance matters to you. It keeps about 2,000 plausible guesses. Every answer makes the
guesses that agree with it more likely and the ones that disagree less likely, so the
engine also knows how *sure* it is. It uses that to:

- **Pick the next question.** It asks where it is least sure *and* where the answer would
  move the most rows. Questions that trade distance against program quality get a boost,
  because they teach it the most. The first 5 questions are standard "calibration"
  questions near the top of your list.
- **Know when to stop.** "List confidence" is the share of neighbouring rows in your top
  100 that the engine is at least 90% sure about. It suggests stopping at 90%, or after 40
  questions. You can always keep going or stop early.
- **Flag answers that no longer fit.** If the engine is now more than 85% sure you'd
  answer a question the other way, it asks "Still true?" It never deletes an answer.

Every answer is "soft" by default. Turn on **"I'm certain"** and the answer also becomes a
hard rule.

**How well does it work?** We tested it on 12 simulated couples. Each one has a hidden
"true" preference, answers 40 questions, and gets 1 in 10 answers wrong on purpose.
Measured against each couple's true order over their top 100 pairs, where 1.0 means
identical:

| | Before any questions | After 40 questions |
|---|---|---|
| Pairwise's question choice | 0.835 | **0.962** (lowest couple: 0.920) |
| Random questions | 0.835 | 0.913 (lowest couple: 0.833) |

Run it yourself with `pnpm --filter @pairwise/engine bench`.

The final list follows every hard rule. Wherever the rules leave a choice, the
higher-scoring pair goes first. For any two rows, the app can tell you **why** one is
above the other.

## Project status

| Phase | What | Status |
|---|---|---|
| 1 | Engine core: pairs, scoring, hard rules, conflict detection, ranking, explanations | ✅ Done |
| 2 | Learning from your answers, smart question choice | ✅ Done |
| 3 | Program data: seed of 57 programs, import + geocoding pipeline | ✅ Done (source research deferred, see [docs/data-sources.md](docs/data-sources.md)) |
| 4 | Backend (Supabase): database, security rules, accounts, partner invites, live sync | ✅ Done, deployed to Supabase (free tier) |
| 5 | Web app: setup and invites, program search with map, rank and tier | ✅ Done |
| 6 | “This or that” comparison cards, conflict resolution | ✅ Done |
| 7 | Final list, versions, export | ✅ Done |
| 8 | Admin review, user-added programs, program import, full NRMP Main Match program list | ✅ Done |
| 9 | Map of the list, activity feed, account page, accessibility pass, deploy | ✅ Live at https://couples-match-ranker.vercel.app (see [docs/deploy.md](docs/deploy.md)) |

## Running it

You need [Node.js](https://nodejs.org) 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test                                   # run the engine's test suite
pnpm engine:cli fixtures/sample.json        # print a ranked list for an example couple
pnpm engine:cli fixtures/sample.json --top 60 --why 2,4   # …and explain why row 2 is above row 4
pnpm --filter @pairwise/data demo internal-medicine pediatrics   # a list built from real seed programs
pnpm --filter @pairwise/data nrmp:load --dry-run                 # what the NRMP directory import would load
```

**Database tests** (`packages/db`) need PostgreSQL 16 with PostGIS on the machine. On
Ubuntu, install them with `apt install postgresql-16 postgresql-16-postgis-3`. The tests
then start a throwaway database by themselves. Alternatively, point `DATABASE_URL` at a
local Supabase (`supabase start`).

**The web app** (`apps/web`):

```bash
pnpm --filter @pairwise/web dev        # http://localhost:3000 (reads apps/web/.env.local)
pnpm --filter @pairwise/web build
pnpm --filter @pairwise/web test       # unit tests
pnpm --filter @pairwise/web e2e        # two-partner browser test against the Supabase project
```

The end-to-end tests sign in as three test accounts: `alex.e2e@example.test`,
`sam.e2e@example.test`, and an admin, `admin.e2e@example.test`. They use a password sign-in that exists only in development
(`PAIRWISE_DEV_LOGIN=1`) and is switched off in production builds. Their password lives in
`apps/web/.env.local`. Reset their data first with `supabase/tests/e2e-reset.sql`.

**Supabase project:** `pairwise` in the Infinite Games organization (free tier, US East),
at `https://julbfusuwcjptyobguxm.supabase.co`. All eight migrations, the specialties and
the NRMP program list are loaded, and the invite email function is deployed. The app
uses the project's **publishable key** (`sb_publishable_…`, under Settings → API Keys in
the Supabase dashboard), not the legacy `anon` key; it goes in `.env.local` as
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

**Environment variables** are listed in [`.env.example`](.env.example). Copy it to
`.env.local` and fill it in; never commit real values. Nothing is needed to run the
tests.

## Accessibility

- Every page is checked automatically (axe, WCAG 2.1 AA, colour contrast included) in
  light and dark mode, signed out, as a couple and as an admin
  (`e2e/layout-a11y.spec.ts`).
- Lists can be reordered with the keyboard as well as the mouse.
- Distance is never shown by colour alone: every band has a word and an icon, and on the
  map a different line style too.
- There's a "Skip to content" link, and animations switch off if your device asks for
  reduced motion.

## Deploying

See [docs/deploy.md](docs/deploy.md): Vercel for the web app, plus a few settings in
Supabase. It also lists what each service costs.

## Repository layout

```
apps/web            Next.js app: the six steps, versions and export, and the admin area
packages/engine     scoring, rules, conflict detection, ranking  ← the product's brain
packages/data       specialties, seed programs, import + geocoding pipeline
packages/db         database types, rows → engine input, live-sync helpers, database tests
supabase/           database migrations (tables + security rules), seeds, invite email function
```

Inside `packages/engine/src`:

| File | What's in it |
|---|---|
| `rules.ts` | Every NRMP number (rank limits, No Match codes, fees), with the year it applies to |
| `defaults.ts` | Every distance band, tier value and model default |
| `candidates.ts` | Builds every possible pair |
| `scoring.ts` | The score for each pair |
| `graph.ts` | The hard rules as a graph of "X must be above Y" |
| `conflicts.ts` | Finds circles, Tier A collisions, surprising answers and partner disagreements |
| `rank.ts` | Produces the list, explains it, and checks manual drags |
| `fees.ts` | NRMP fee estimate |
| `learning.ts` | Learns your trade-offs from your answers |
| `questions.ts` | Picks the next question; works out list confidence and when to stop |
| `bench/` | Simulated couples, used to measure how well the learning works |

Inside `packages/data/src`:

| File | What's in it |
|---|---|
| `specialties.ts` | The list of specialties, and which NRMP match each one belongs to |
| `pipeline.ts` | Turns imported rows into programs, plus a review list for an admin |
| `geocode.ts` | Looks up map positions (Census and OpenStreetMap), with caching and rate limits |
| `cbsa.ts` | Works out which metro area a point is in |
| `seed.ts` | The seed programs, and the No Match entries |
| `text.ts` | Turns reasons into plain English |

## Program data

- **The NRMP Main Residency Match directory.** Every rankable program track in the 2027
  Main Match: 7,096 tracks in 49 specialties, from the public NRMP Program Directory
  (`nrmp-directory/`, approved in [docs/data-sources.md](docs/data-sources.md)).
  - Each track is one program, with its **official NRMP code**, so couples don't type
    codes from R3. Withdrawn and not-participating tracks are left out.
  - Preliminary, advanced, physician-only and extra tracks are labelled in the name
    ("(Advanced)", "(track 2)").
  - **Locations are city centres**, because the directory has no street addresses.
    Distances between cities are accurate; two programs in the same city count as 0
    miles apart. Hospitals that were in the seed list have their exact address, and so
    do all their other specialties.
  - To reload after a new directory export, see `nrmp-directory/README.md`.
- **Seed.** The original 57 hand-entered programs. They've been merged into their NRMP
  tracks, keeping their exact addresses. One (Boston Medical Center Pediatrics) has no
  directory track and stays as it was.
- **Programs couples add.** If a program isn't listed, a couple can add it ("Add a
  program not listed"). It's found on the map, offered as a match if something similar
  is already listed, and kept private to that couple until an admin approves it.
- **Import pipeline.** Takes a spreadsheet (CSV) of programs and does four things:
  1. Maps every specialty spelling ("Med-Peds", "OB/GYN") to one list of specialties,
     each tied to the NRMP match it belongs to.
  2. Finds each program on the map using free services (US Census first, then
     OpenStreetMap), and remembers every answer so it never looks the same address up
     twice.
  3. Works out which metro area (CBSA) each program is in.
  4. Sends anything doubtful to an admin review list: a vague map location, a possible
     duplicate, or a program outside every metro.

  The admin import screen uses this for smaller lists from other sources.

### Admin

Admins see an **Admin** link in the app's header (go to `/admin`). To make someone an
admin, set `is_admin` to true on their row in the `profiles` table in the Supabase
dashboard.

- **Review** lists what needs a human look:
  - **Possible duplicates.** Click "Keep this one" and the other is merged into it.
    Every couple who listed the duplicate keeps their place, answers and codes.
  - **Needs a look.** Programs couples added, and programs with no map location or a
    doubtful one. You can approve, edit, look the address up again, set the location by
    hand (paste coordinates from a map app), or merge into another program.
  - **Imported, nothing flagged.** Spot-check, then "Approve all".
- **Import** takes a CSV of up to 300 rows and shows a preview before anything is saved.
  The columns are: name, institution, specialty, street, city, state, zip, acgme_id,
  is_advanced, source_id. Only name, specialty, city and state are required.

## Accounts, partners and privacy

- **Sign-in** is by emailed magic link, or optionally Google. There are no passwords.
- **Inviting your partner.** Partner 1 enters Partner 2's email address. Partner 2 gets a
  single-use link that expires in 7 days, and must sign in with that same address to
  accept. Partner 1 can resend the invite (which cancels the old link) or revoke it.
- **One couple per match year.** Each person can be in one active couple per match year,
  and both partners must be in the same NRMP match.
- **Who can see what.** The database enforces privacy for every request, not just in the
  app. Only the two partners can see a couple's lists, answers and versions, and each
  partner can only edit their own rank list. This is covered by the test suite,
  including the spec's "a third user cannot read the couple's data" check on every
  table.
- **Live sync.** Both partners see list edits, answers and resolved conflicts as they
  happen, plus who is doing what ("Alex is answering comparisons").
- **Leaving and deleting.** If either partner leaves, the couple becomes read-only and is
  deleted after 30 days. Deleting your account removes your data immediately.

Design choices that weren't spelled out in the spec are recorded in
[DECISIONS.md](DECISIONS.md).
