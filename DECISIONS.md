# Decisions

These are choices made where the spec was silent or ambiguous. In each case the simpler
option was taken. Newest phases are at the bottom.

## Phase 1: Engine core

1. **NRMP values are unverified.** nrmp.org couldn't be reached from the build
   environment, so every value in `packages/engine/src/rules.ts` comes from the spec as
   written. `NRMP_RULES.lastVerified` is `null` until someone checks them by hand.
   Details to confirm:
   - Whether the length-of-list fee exists in the current year, and whether it is charged
     per partner (the engine assumes per partner).
   - Whether "20 unique codes" includes the No Match code.
2. **Tiers outrank ranks.** If a partner's list puts a Tier B program above a Tier A one,
   the engine orders by tier first and by rank within the tier. The UI's tier zones
   should make this impossible anyway.
3. **Unknown distance counts as Apart.** A program without coordinates is treated as
   Apart from everything, unless it shares a CBSA with the other program. A missing
   geocode therefore never makes a pair look closer than it is.
4. **No Match pairs and dominance.** A No Match pair has no distance penalty in the score,
   so for the dominance rule it sits at the "Together" level. For example,
   (MGH, Boston Children's) dominates (MGH, No Match), but (MGH, far-away program) does
   not. The separate No-Match-at-bottom rule is what pushes No Match pairs down.
5. **Tier A collisions.** The collision exists when both partners' Tier A rules are hard
   and both have Tier A programs and non-A programs. In that case the contested edges are
   dropped from the graph. Those edges are (P1 gets A, P2 doesn't) vs. (P2 gets A, P1
   doesn't).
   - Until the couple answers, the engine shows one `tier_a_collision` conflict instead of
     dozens of cycles.
   - "Partner 1" or "Partner 2" restores that partner's edges.
   - "Case by case" leaves those orderings to scores and comparisons.
6. **"Strong" Tier A mode** adds a score bonus of 3.0 (`TIER_A_STRONG_BONUS` in
   `defaults.ts`). Under the default model the widest gap between two matched pairs is
   2.4, so the bonus is larger than that gap. Once the model is fitted, the bonus can be
   outweighed, which is what makes "strong" softer than "hard".
7. **`scorePairs` takes the couple's settings** as an optional third argument. The pair
   score depends on the balance slider `w` and on strong-mode bonuses, and neither is
   part of the posterior.
8. **Pins come only from the `pins` input.** Locked comparisons don't create edges by
   themselves; the app writes a pin when "I'm certain" is on (spec 5.6). This avoids
   counting the same assertion twice.
9. **Disagreements.** A question is a disagreement when two different people's latest
   answers to it pick different winners and no answer is marked `bothAgreed`. If only
   one partner has answered so far, that answer counts.
10. **Cycles don't stop the list from being shown.** While a cycle is unresolved, the
    edges inside it are ignored when ordering (the list is flagged `hasCycles`), so the
    couple still sees a list.
11. **Breaking a rule link can take more than one step.** Dominance edges are stored
    transitively reduced, as the spec asks. So "A above C" can hold through more than
    one in-between pair. Breaking one link can reveal the next cycle, which the couple
    resolves the same way. In tests this takes at most two steps.
12. **Hub nodes for complete rules.** "Every Tier A pair above every non-A pair" and
    "every matched pair above every No Match pair" go through a hidden hub node
    (top → hub → bottom) instead of thousands of separate edges.
    - This cut a full rebuild of 323 pairs from ~33 ms to ~3–5 ms.
    - Explanations and cycles still report pair-to-pair links, each carrying every
      reason between the two pairs.
13. **Pair ids** are `programA|programB`, with `NO_MATCH` as the sentinel program id.
    The database sentinel rows (codes 999999999 and 888888888) map to this.
14. **NRMP code format check** is `^[0-9]{7}[A-Z0-9][0-9]$` (9 characters). It checks
    format only, as the spec asks.
15. **Inversion report.** For each row, the engine reports the best-ranked program that
    partner gives up until further down the list, and why: the pair is closer, and/or the
    other partner gets a better program. The spec said the reason is "always a distance
    band", but it can also be the partner's program.

## Phase 2: Learning

16. **The score is linear in 12 parameters.** The score is S = θ·φ(pair) + bonus, where
    θ packs the tier values, within-tier spreads, three distance penalties and v_NM
    (`features.ts`). This makes several things cheap:
    - Posterior means and SDs of every score come straight from θ's mean and covariance
      (`scorePairs` no longer loops over particles).
    - Each answer reduces to one 12-number difference vector.
17. **The prior is built so the model's own assumptions always hold.** Particles live in
    an unconstrained latent space, z ~ N(0, I) (`learning.ts`). The transform to
    parameters guarantees, for every particle:
    - every Tier A program beats every Tier B one, and every Tier B beats every Tier C;
    - 0 ≤ pen(commutable) ≤ pen(drivable) ≤ pen(apart);
    - v_NM sits below every Tier C value.

    z = 0 is exactly the default parameters. Widths are in `defaults.ts` (`PRIOR_LOG_SD`).
18. **Resample-move.** Reweighting and resampling alone collapse to a handful of distinct
    particles after a few dozen answers. So after each resample, every particle takes 3
    Metropolis steps against all answers so far. This is a standard addition to the
    spec's particle filter, and it keeps the posterior diverse.
19. **Ties** use the likelihood 4·σ(βd)·σ(−βd), which is highest when the two scores are
    equal. β = 6 (`BT_BETA`).
20. **Question uncertainty uses P(the order is right), not the answer prediction.** The
    spec says "uncertainty = 1 − |2p − 1| using the posterior predictive p". If p
    includes answer noise, two pairs the model is *confident are about equal* look
    maximally uncertain, and asking about them teaches nothing. Using p = P(θ ranks left
    above right) instead raised the benchmark (12 couples):
    - mean τ after 40 questions: 0.931 → 0.952 (later 0.962, with change 22);
    - couples where active beat random: 8/12 → 10/12.

    The predictive probability is still returned as `pLeft` for display.
21. **Impact** is the number of list positions between the two pairs (the rows that would
    move if their order flipped). Positions past 100 count ¼, because the stopping rule
    and the couple's attention are on the top 100.
22. **Calibration.** There are 5 opening questions (`CALIBRATION_QUESTIONS`), built from
    templates:
    - (Apart vs. Together), (Drivable vs. Together), (Commutable vs. Together),
      (Apart vs. Commutable), (Apart vs. Drivable). In each, the farther pair is better
      for at least one partner.
    - One "partner 1 does better vs. partner 2 does better" question at the same
      distance.

    For each template the engine picks the most uncertain open question in the top 30
    rows, widening to 60 and then 100 only if needed. Searching near the top first
    improved results:
    - mean τ: 0.952 → 0.962;
    - active beat random: 10/12 → 11/12.
23. **The question pool** is pairs within 20 positions in the current *full* order (not
    just the truncated list) that the hard rules don't already order and that haven't
    been asked. The random baseline draws from the same pool, so the benchmark isolates
    the *choice* of question.
24. **`nextQuestions(list, posterior, k, opts)`** takes the ranked list instead of
    `(pairs, graph, …)`. It needs the current positions, and the list already carries
    the graph and pairs. `fitModel(prior, comparisons, ctx)` takes the candidate pairs
    and settings in `ctx`, because answers refer to pairs by id.
25. **`runEngine(input)` fits from the prior** using `input.seed` when no posterior is
    passed. A saved version is therefore reproduced exactly by re-running its
    inputs_snapshot.
26. **Fitting cost.** Fitting 40 answers takes about 170 ms with 2,000 particles. That is
    fine after each answer, but in the web app it should run in a Web Worker so typing
    and dragging never stall. Ranking, conflicts and question selection stay well inside
    their budgets (about 8 ms and 5 ms for 323 pairs).
27. **Simulated couples for the benchmark** (`src/bench/simulate.ts`):
    - 15 programs each, spread over 6 of 9 metros;
    - 1–3 Tier A programs and 5–8 Tier B; the rest are Tier C;
    - both Tier A rules hard, with the couple choosing "case by case" when Tier A
      programs collide;
    - hidden parameters drawn from the prior.

    Their true list is the engine's own output given the true parameters. They answer by
    comparing true scores, and 10% of answers are flipped.

## Phase 3: Program data (research deferred)

28. **The data-source research step was skipped, at the owner's request.**
    `docs/data-sources.md` lists what it must answer. Until then, the pipeline only takes
    hand-assembled CSV files and never fetches program lists itself. The sites involved
    (acgme.org, FREIDA, nrmp.org) are blocked from the build environment anyway.
29. **The seed is entered by hand and unverified.**
    - It has 57 real programs (IM, Peds, General Surgery, EM, Psychiatry) at 30 teaching
      hospitals in the six required metros.
    - Coordinates are approximations of each primary teaching hospital, entered from
      memory, because the Census geocoder and Nominatim are blocked here. Every row has
      `geocodeSource: 'manual'`, confidence 0.75 and `verified: false`.
    - `pnpm --filter @pairwise/data geocode:seed` re-geocodes every row and reports drift
      once the network allows it. `--write` updates the rows.
    - CBSA codes and names follow the 2023 OMB delineations and are also unverified.
    - Program names follow ACGME-style sponsor naming, but they are not copied from ACGME
      and have no ACGME IDs or NRMP codes.
30. **Program ids are readable strings**, e.g. `seed-mgh-internal-medicine`, and imports
    use `acgme-<id>` when a source provides ACGME IDs. Ids stay stable across
    re-imports. Phase 4's `programs.id` should therefore be `text`, not `uuid`.
31. **Two extra columns:** `geocode_confidence` and `geocode_source`. The spec asks us to
    "store geocode confidence", and these drive the review queue.
32. **Geocoding.** The geocoders are tried in order:
    - US Census first. One match gives confidence 0.95; several matches give 0.7.
    - Nominatim as a fallback. A hospital or building hit gives 0.85, any other hit
      0.6, and a city centroid 0.3.

    Below 0.8 a program goes to review (`GEOCODE_REVIEW_THRESHOLD`). Nominatim is called
    at most once every 1.1 s, with a generic User-Agent. Every answer is cached,
    including "not found", in `.cache/geocode.json`, which is git-ignored.
33. **Review queue reasons:** `no_geocode`, `low_confidence`, `possible_duplicate` and
    `outside_cbsa`.
    - A possible duplicate is a program with the same id, or with the same specialty,
      the same institution name and within 1 mile of an existing one. It is held back
      from the import instead of being added twice.
    - Specialties outside the NRMP (Urology, Ophthalmology) and unknown spellings are
      rejected rather than guessed.
34. **Who is "verified".** A cleanly imported row (confident geocode, no flags) is
    marked verified. Seed rows (manual coordinates) and user-added programs are not:
    user-added programs stay private to the couple until an admin approves them.
35. **The CBSA lookup has two versions.** Phase 4 will use PostGIS in the database. A
    TypeScript point-in-polygon version over the Census boundary GeoJSON lets imports be
    checked offline and in tests. Boundary files aren't committed (they are large); the
    import takes `--cbsa <file>`.
36. **SMS fellowship match names are an illustrative subset and unverified.** The list
    puts medicine and pediatric fellowships under "Medicine and Pediatric Specialties".
    The full fellowship list should come from the approved data source.
37. **`supabase/seed/programs.sql` is generated** by `pnpm --filter @pairwise/data seed:sql`.
    It inserts the No Match sentinels (codes 999999999 and 888888888) and the seed
    programs, with `geom` as a PostGIS geography point. It targets the Phase 4 schema.
