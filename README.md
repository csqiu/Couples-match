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
   into R3.

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
| 4 | Backend (Supabase): accounts, partner invites, live sync | Next |
| 5–7 | Web app screens, comparison cards, final list, versions, export | |
| 8–9 | Full program import, admin, polish, deploy | |

## Running it

You need [Node.js](https://nodejs.org) 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test                                   # run the engine's test suite
pnpm engine:cli fixtures/sample.json        # print a ranked list for an example couple
pnpm engine:cli fixtures/sample.json --top 60 --why 2,4   # …and explain why row 2 is above row 4
pnpm --filter @pairwise/data demo internal-medicine pediatrics   # a list built from real seed programs
```

There are no environment variables or secrets yet. When the web app and Supabase arrive,
the required variables will be listed here, and they belong in `.env.local`. Never
commit them.

## Repository layout

```
apps/web            Next.js app                                  (Phase 5+)
packages/engine     scoring, rules, conflict detection, ranking  ← the product's brain
packages/data       specialties, seed programs, import + geocoding pipeline
supabase/           database migrations, security policies       (Phase 4)
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

There is no public NRMP file of program codes with locations, so Pairwise builds its own
program list:

- **Seed.** 57 real programs in Internal Medicine, Pediatrics, General Surgery, Emergency
  Medicine and Psychiatry, across Boston, New York, Baltimore/DC, Chicago, the Bay Area
  and Houston (`packages/data/seed/programs.json`). Their map positions were entered by
  hand and haven't been checked by a geocoder yet. They have no NRMP codes: each couple
  types their own codes from R3.
- **Import pipeline.** Takes a spreadsheet (CSV) of programs and does four things:
  1. Maps every specialty spelling ("Med-Peds", "OB/GYN") to one list of specialties,
     each tied to the NRMP match it belongs to.
  2. Finds each program on the map using free services (US Census first, then
     OpenStreetMap), and remembers every answer so it never looks the same address up
     twice.
  3. Works out which metro area (CBSA) each program is in.
  4. Sends anything doubtful to an admin review list: a vague map location, a possible
     duplicate, or a program outside every metro.

  Which websites we may take the full program list from is still being researched; see
  [docs/data-sources.md](docs/data-sources.md).

Design choices that weren't spelled out in the spec are recorded in
[DECISIONS.md](DECISIONS.md).
