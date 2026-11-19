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
to you. *(The tuning is Phase 2. Right now the engine uses sensible defaults.)*

The final list follows every hard rule. Wherever the rules leave a choice, the
higher-scoring pair goes first. For any two rows, the app can tell you **why** one is
above the other.

## Project status

| Phase | What | Status |
|---|---|---|
| 1 | Engine core: pairs, scoring, hard rules, conflict detection, ranking, explanations | ✅ Done |
| 2 | Learning from your answers, smart question choice | Next |
| 3 | Research on program data sources, plus a seed of about 50 programs | |
| 4 | Backend (Supabase): accounts, partner invites, live sync | |
| 5–7 | Web app screens, comparison cards, final list, versions, export | |
| 8–9 | Full program import, admin, polish, deploy | |

## Running it

You need [Node.js](https://nodejs.org) 20 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test                                   # run the engine's test suite
pnpm engine:cli fixtures/sample.json        # print a ranked list for an example couple
pnpm engine:cli fixtures/sample.json --top 60 --why 2,4   # …and explain why row 2 is above row 4
```

There are no environment variables or secrets yet. When the web app and Supabase arrive,
the required variables will be listed here, and they belong in `.env.local`. Never
commit them.

## Repository layout

```
apps/web            Next.js app                                  (Phase 5+)
packages/engine     scoring, rules, conflict detection, ranking  ← the product's brain
packages/data       program import + geocoding scripts           (Phase 3)
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
| `text.ts` | Turns reasons into plain English |

Design choices that weren't spelled out in the spec are recorded in
[DECISIONS.md](DECISIONS.md).
