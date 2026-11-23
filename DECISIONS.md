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

## Phase 4: Backend

38. **No Supabase project yet.** Creating one could cost money, and the spec says to ask
    first. Everything was therefore built as standard Supabase migrations
    (`supabase/migrations`) and tested against a plain local Postgres 16 + PostGIS.
    - `supabase/tests/supabase-shim.sql` supplies the bits of Supabase the migrations
      rely on: the anon, authenticated and service roles, `auth.users`, `auth.uid()`
      read from the request's JWT claims (the same mechanism PostgREST uses), and the
      `supabase_realtime` publication.
    - Every statement in the shim is guarded, so on real Supabase it does nothing.
    - The tests switch to the `authenticated` role with a given user's claims, so row
      level security is exercised exactly as it would be from the app.
39. **Couple membership.** It lives in `couples.partner_a` and `partner_b`, as in the
    spec, with a status of `pending`, `active` or `dissolved`.
    - "One active couple per match year" is a trigger with an advisory lock.
    - Partner A can start building their list while the invite is pending.
    - Members can change a couple's `settings` only. Partners, status and match change
      only through security-definer functions; column-level grants enforce this.
40. **Invites.**
    - Tokens are 32 random bytes, stored only as a SHA-256 hash.
    - `create_invite` returns the token once. The `send-invite` Edge Function calls it
      *as the user* and puts the token only in the email, so the browser never sees it.
    - Resending creates a new link and revokes the old one. There is one open invite at
      a time.
    - `accept_invite` requires the signed-in email to match the invite, checks expiry and
      single use, and refuses partners in different matches (the `specialties` table
      maps each specialty to its match).
    - `invite_preview(token)` lets the landing page show who invited you before you sign
      in.
41. **Leaving and deletion.**
    - `leave_couple` dissolves the couple. Former members can still read it but not
      change it.
    - A daily job (`pg_cron` on hosted Supabase) deletes couples dissolved more than 30
      days ago.
    - `delete_my_account` deletes the auth user. This cascades to their profile and rank
      list. Their past answers and versions stay with the couple, with the author shown
      as unknown. The couple is dissolved, or deleted outright if nobody is left.
42. **"Private tiers" hides tiers in the UI only.** The spec says the partner's tiers are
    still *used by the engine*, which runs in the browser. Both partners' rows are
    therefore readable by both, and the app hides the partner's tiers when
    `settings.privacy = 'private_tiers'`. True secrecy would need the engine to run
    server-side.
43. **Programs store `lat`/`lon`, and `geom` is generated from them.** The client reads
    and writes plain numbers, and PostGIS still gets a geography column for distances
    and metro lookup. Program CBSAs are assigned by a trigger once `cbsa_boundaries` is
    loaded; until then the given code is kept.
44. **Distances.** The spec asks for a "materialized helper", but a materialized view
    can't carry row-level security. `couple_pair_distances` is therefore a normal
    `security_invoker` view, plus `pair_distance_mi(a, b)`. The engine also computes
    distances itself from the coordinates, so the client never depends on the view.
45. **Activity feed.** Statement-level triggers write one `audit_events` row per change
    per couple, e.g. "individual_ranks.update, count 12" for a drag-and-drop, plus
    settings and status changes. Users can read the feed but never write it.
46. **Live sync.**
    - The eight shared tables are in the `supabase_realtime` publication, with full row
      images so deletes still carry `couple_id`.
    - Presence uses a private channel per couple, `couple:<id>`. A policy on
      `realtime.messages` admits only members; it is created only where Supabase
      Realtime exists.
    - `packages/db/src/realtime.ts` wraps both for the app, with last-write-wins rank
      edits (the undo toast is UI, Phase 5).
47. **The rank-uniqueness constraint is deferrable,** so a drag-and-drop reorder can
    rewrite many ranks in one statement.
48. **Database types (`packages/db/src/database.types.ts`) are hand-written** in the shape
    `supabase gen types` produces. Regenerate them once a project exists.
49. **Two pieces are not tested here:**
    - The `send-invite` Edge Function: no Deno or email service in this environment.
    - The `realtime.messages` policy: no Supabase Realtime here.

    Both should be checked on a real Supabase project, local or hosted.
50. **Deployed to a hosted Supabase project.** It is `pairwise`, ref
    `julbfusuwcjptyobguxm`, on the free plan in us-east-1, in the existing "Infinite
    Games" organization, chosen by the owner. Migrations 1–4 applied unchanged and the
    seeds loaded.
    - The two pieces that couldn't be tested locally exist and are wired up: the
      `realtime.messages` channel policy, and the `pg_cron` purge job (04:17 UTC daily).
51. **Migration 5 (hardening) fixes what Supabase's advisors flagged:**
    - The trigger helpers were executable over `/rest/v1/rpc`, because Postgres grants
      EXECUTE to PUBLIC on functions created after a blanket revoke. They are now
      revoked, and the schema's default privileges no longer grant EXECUTE.
    - `protect_list_version` was missing a pinned search_path.
    - Eleven foreign keys lacked indexes.

    The remaining advisor warnings are the intended API: nine invite and membership
    functions for signed-in users, and `invite_preview` for signed-out visitors (the
    token is the secret). A new test locks in exactly that list.
52. **`send-invite` checks its email settings first.** If `RESEND_API_KEY`,
    `INVITE_FROM_EMAIL` or `APP_URL` is missing, it returns 503 `email_not_configured`
    *before* creating an invite, rather than creating one and revoking it. It is
    deployed (JWT required) and compiles on Supabase's runtime. It is still untested
    end to end, because no email key exists yet.

## Phase 5: Web app (steps 1–3)

53. **Next.js 16 (App Router) with Tailwind 4.** Pages read data in server components;
    writes go through server actions, as the spec asks. Two things are new in Next 16:
    session refresh lives in `src/proxy.ts` (middleware was renamed), and Turbopack is
    the default bundler.
    - Turbopack can't map `./x.js` imports to `x.ts` files, so the packages now import
      their siblings without an extension. TypeScript, Vitest, tsx and Next all accept
      that.
54. **shadcn/ui-style components, written by hand.** The shadcn generator's site is
    blocked from the build environment. `src/components/ui/` follows the same pattern:
    Tailwind with `class-variance-authority`, no Radix needed so far.
    - Colors are CSS variables, with light, dark and system modes; the toggle is stored
      in localStorage.
    - One accent color (teal), and touch targets of at least 44px.
55. **Branding is in one file, `src/brand.ts`** (name, tagline, description, support
    email).
56. **Invite fallback while email isn't set up.** Partner A first tries the
    `send-invite` Edge Function. If it replies `email_not_configured`, the server creates
    the invite itself and shows partner A a copyable link to send.
    - The link still works only once, only for the invited email, and only for 7 days.
      The email-match check at accept time is what protects it.
    - Once email is configured, the token goes only into the email again.
57. **Dev-only password sign-in.** It is used by automated tests and is enabled only
    when `PAIRWISE_DEV_LOGIN=1` *and* `NODE_ENV` isn't production.
    - The two test accounts were created directly in `auth.users` with a random password
      kept in the git-ignored `apps/web/.env.local`.
    - Real users only get magic links or Google.
58. **The match year rolls over in April.** From April on, people are preparing for
    next year's March Match; setup offers that year and the one after.
59. **Rank and tier board.** It uses dnd-kit with three sortable lists. Saving rewrites
    the whole list in one statement (ranks 1..n: Tier A, then B, then C), relying on the
    deferrable unique constraint. Last write wins, and every move offers **Undo**.
    - Keyboard dragging needed a custom coordinate getter, because dnd-kit's default
      handles only a single list. ↑/↓ jump to the nearest row or empty tier box.
      Non-empty tier boxes aren't drop targets; otherwise ↑ from a tier's first row
      would land on its own box.
    - A keyboard move into another tier lands at the edge of that tier: the end of the
      tier above, or the start of the tier below. Pointer drags drop where released.
    - Each row also has a tier menu, up and down arrows, an acceptable switch, an NRMP
      code field (format-checked, saved per couple, confirmed with a toast) and remove.
    - The drag context has a stable `id` (`useId`), so its accessibility ids match
      between server and client rendering.
60. **Map.** MapLibre GL 6 with OpenFreeMap tiles (positron and dark styles, no API key).
    - My programs are filled teal dots; my partner's are rings, with a toggle to hide
      them.
    - MapLibre 6's worker can't be located by the bundler, so
      `scripts/copy-maplibre-worker.mjs` copies it to `public/maplibre/` before dev and
      build.
61. **Live sync** uses the Phase 4 helper: Postgres Changes trigger a debounced
    `router.refresh()`, and presence shows "<partner> is ranking/answering…". Both were
    verified live, including the private-channel access policy, which only real
    Supabase could test.
62. **"Private tiers" is a UI promise, as noted in decision 42.** The programs page shows
    the partner's programs but never their tiers. Phase 5 shows only my own tiers
    anyway.
63. **User-added programs ("Add a program not listed") are in Phase 8**, as the spec's
    build plan says. Phase 5 searches the shared program list only.
64. **End-to-end test** (`apps/web/e2e/couple-flow.spec.ts`). It drives two browsers
    against the real Supabase project.
    - It checks setup, invite, accept, search and add, the map pins, the tier menu,
      arrows, acceptable switch, code validation, keyboard drag across tiers, that
      everything is still there after a reload, presence, and live sync.
    - It also asserts no browser errors, and no sideways scrolling at 390px on every app
      page.
    - Running it in this sandbox needs `NODE_USE_ENV_PROXY=1`, because Node's fetch
      ignores HTTPS_PROXY. The Playwright config routes the browser through `HTTPS_PROXY`
      when it is set.
