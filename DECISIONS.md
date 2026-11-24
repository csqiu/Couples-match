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

## Phase 6: Comparisons and conflicts

65. **The engine runs in the browser, in a Web Worker** (`src/lib/engine.worker.ts`),
    as the spec intends.
    - The server loads the couple's rows through RLS (`loadCoupleBundle`). The worker
      builds the engine input, fits the model, and returns the next question, list
      confidence and conflicts (`src/lib/analysis.ts`, which is pure and unit-tested).
    - If Web Workers aren't available, it runs on the main thread instead.
66. **Answers appear immediately** and save in the background. A "Saving… / All
    answers saved" status shows when it's safe to leave; leaving mid-save can lose the
    answer, which the e2e test caught. "Undo last" deletes the saved answer and its pin.
67. **"I'm certain"** saves the answer as `locked` and adds a pin (`source =
    comparison`). Breaking that pin in a cycle deletes the pin and unlocks the answer,
    which stays as a soft answer.
68. **Answering together vs. separately.**
    - Together: one answer counts for both partners (`both_agreed = true`).
    - Separately: each answer is the person's own. Each partner is first asked the
      questions the other answered and they haven't, so answers can be compared. A
      different answer becomes a disagreement, which doesn't count until it is settled
      on the conflicts page (an agreed answer is added).
    - In separate mode a lone answer counts until the other partner answers differently
      (decision 9).
69. **Conflict actions:**
    - *Cycle:* tap one statement to drop it. A pin is deleted; an automatic or rule link
      gets a `rule_exceptions` row scoped to those two pairs.
    - *Tier A collision:* "<Partner 1> / <Partner 2> gets priority" or "Decide case by
      case", stored as `settings.tierAPriority`.
    - *Surprising answer ("Still true?"):* "Yes" locks it and adds a pin, and it is never
      flagged again. The engine now skips locked answers. "Actually, the other one"
      flips it; "Remove" deletes it. Answers are never removed automatically.
70. **Mini-maps** are small, non-interactive MapLibre maps, one per pair card. They are
    updated in place between questions rather than recreated, so the browser doesn't run
    out of map (WebGL) contexts.
71. **The "Compare" step shows as done after 5 answers**, i.e. once the calibration
    questions are answered. The conflicts step has no checkmark, because whether it's
    clear depends on the engine run in the browser.

## Phase 7: Final list, versions, export

72. **The final list is the engine's full order** (up to 300 pairs), computed in the
    Web Worker (`src/lib/final-list.ts`). The couple's chosen length shows the first
    *n*.
    - The length slider updates the fee estimate and checklist instantly in the
      browser, and saves `settings.listLength` after a short pause.
    - "Why is this here?" explains each row relative to the row above it: either the
      chain of rules and answers, or "fits your answers better" with the two scores.
73. **Up to 300 rows, not a virtualized table.** The spec asks for virtualization, but
    300 rows render quickly without it, and drag-and-drop, keyboard navigation and
    find-in-page keep working. CSS `content-visibility` was tried; it was removed
    because rows of different heights on phones jumped and left blank gaps.
74. **Drag to reorder.** Dropping a row above (or below) another asks the engine
    (`proposeMove`):
    - If allowed, it saves a `manual_drag` pin, with Undo.
    - If blocked, it shows the blocking reasons in plain English with **Override with
      an exception** (each blocking link is broken as in Phase 6, then the pin is saved)
      or **Cancel**.
75. **Proximity styling** lives in one place (`src/components/proximity.tsx`). It is used
    by the final list, the comparison cards, the conflicts page and the version diff.
    Each band has a tint (or dashed border), a text badge and an icon; color is never
    the only signal.
76. **Fees** are computed from `rules.ts` for whatever length is chosen (`feesFor`):
    unique program codes per partner (No Match counts), extra-rank fee, length fee,
    couples fee, and a warning when cutting a few pairs drops a fee tier. All are
    labelled as unverified estimates; base registration fees aren't included.
77. **Saving a version runs the engine on the server** (a server action using the same
    `computeFinalList` code), not in the browser. What's frozen therefore can't be
    affected by a stale browser tab. The spec suggests an Edge Function; a server
    action runs the identical TypeScript without a Deno port.
    - It stores `inputs_snapshot` (the exact engine input), `engine_version`, and the
      ordered rows with names and NRMP codes.
    - The browser sends the length currently shown, and exactly that is frozen. The
      slider saves after a short pause, and an e2e run caught a version saved before
      the slider's value landed.
78. **Restore** uses a security-definer function (`restore_version`, migration 6),
    because it rewrites *both* partners' lists, which row level security doesn't let
    one partner do.
    - The app first saves the current list as a version ("Before restoring …"), so
      restoring never loses work.
    - It restores lists, answers (locked state included), pins, exclusions, exceptions
      and engine settings. App-only settings such as privacy are kept.
79. **Version diff** compares any two versions, or a version against the current list.
    Rows are shown in the newer order, marked moved up or down (old → new rank), added,
    or removed.
80. **Export.**
    - **CSV:** rank, each partner's program and NRMP code, distance and band, downloaded
      in the browser.
    - **PDF:** a printable page (`/print/list`, optionally `?version=`) the browser
      saves as PDF. It has one table per partner, because each partner types their own
      list into R3, then both side by side, plus the checklist and fee estimate. Using
      the browser's print-to-PDF avoids a PDF library and keeps text selectable; the
      e2e test renders it to a real PDF.
81. **The pre-certification checklist** checks: equal lengths (always true for a pair
    list), NRMP codes present for every program per partner (naming the missing ones),
    No Match pairs at the bottom, and no unresolved conflicts.
82. **Not in Phase 7:** the whole-list map view, activity feed and account page that the
    spec lists under "other screens". They aren't in the Phase 7 plan; they belong to
    Phase 9 polish.

## Phase 8: Admin review, user-added programs, import

83. **Seed locations checked.** With the Census and OpenStreetMap geocoders allowed,
    `geocode:seed` placed all 57 hand-entered seed programs within 0.26 miles of where I
    had put them. 53 now use the geocoder's point; the 4 Stanford programs keep the
    hand-entered point, because OpenStreetMap was only 60% sure. They still need an
    admin to approve them.
84. **"Add a program not listed"** sits under the program search.
    - The address is looked up on save (Census, then OpenStreetMap, cached for each
      server process).
    - If an already-listed program in the same specialty is within a mile, the couple
      is asked "Is it one of these?" before a new program is created. This catches most
      duplicates at the source.
    - If the address can't be found, the couple can still save the program without a
      location, with a warning that distances won't work for it.
    - A couple's program is private to that couple (RLS, unchanged from Phase 4) and
      goes to the admin queue.
85. **Admins are marked by `profiles.is_admin`**, set by hand in the database. There is
    no screen for making someone an admin. The admin area is `/admin`, and anyone else
    gets a plain 404. Both the layout and each page check, because Next renders them in
    parallel.
86. **The review queue** has three groups.
    - **Possible duplicates.** "Keep this one" merges the other into it; "they're
      different" approves both.
    - **Needs a look.** Couple-added programs, programs with no location, and programs
      whose location confidence is under 0.8 (the pipeline's threshold).
    - **Imported, nothing flagged.** Approve them one at a time, or all at once.
87. **Duplicate rule.** The database lists every unverified same-specialty pair within
    a mile (`program_duplicates`). On medical campuses (Texas Medical Center, Longwood)
    that flags many different hospitals. So a pair is shown only if:
    - it's practically the same address (under 0.15 mi), or
    - the names are similar (at least 0.3 word overlap, ignoring the specialty's own
      words and generic words like "hospital"), or
    - the institutions are similar (at least 0.6 overlap).

    On the live data this took the list from 6 false alarms to 0.
88. **Merging** (`merge_programs`, migration 7, admin-only) moves everything that used
    the duplicate onto the kept program, for every couple:
    - **Rank rows.** If a partner listed both, the better rank is kept along with its
      tier, and a typed NRMP code or note carries over. Ranks are then renumbered with
      no gaps.
    - **Pair ids.** These are rewritten in comparisons, pins, rule exceptions and
      exclusions. Rows the rewrite makes meaningless are dropped, such as a pair
      compared with itself or a duplicate exception.
    - **Saved versions** are left alone, because they're frozen snapshots. Restoring an
      old version that mentions a merged program drops that program, the same as any
      program that no longer exists.
    - Merging into another couple's private program is refused.
89. **Approving** a couple's program sets `verified` and clears `created_by_couple`, so it
    becomes global for its match. The admin can edit its name and address first. A
    location set by hand gets `geocode_source = 'manual'` and confidence 1.
90. **Admin CSV import** (`/admin/import`) runs the Phase 3 pipeline. Nothing is saved
    until the admin confirms the preview.
    - The preview shows new, updated, flagged, skipped-as-duplicate and rejected rows.
      A row whose id is already in the database counts as an update, not a duplicate.
    - Saving goes through `import_programs`, an admin-only function, rather than letting
      admins insert rows directly. That keeps the `id` column closed to couples, who
      could otherwise claim an id a later import needs.
    - A re-import never overwrites a location an admin set by hand, never un-approves a
      program, and never touches a couple's program.
    - Each upload is limited to 300 rows, because geocoding takes about a second a row
      and the page waits for it. Larger files should be split; the command-line import
      (`pnpm --filter @pairwise/data import`) has no limit.
91. **Metro areas (CBSA)** are still not assigned. The database trigger assigns them from
    `cbsa_boundaries`, which is empty until the Census boundary file is loaded (it's
    large, so this waits for the full import). Until then "same metro" falls back to
    distance alone.
92. **End-to-end test** (`e2e/program-admin.spec.ts`) uses a third test account,
    `admin.e2e@example.test`, which is an admin. The test runs after the couple test
    and covers:
    - the "is it one of these?" offer;
    - adding a new program;
    - the couple's program appearing in the queue;
    - merging it into a listed program, after which the couple's list holds the listed
      program instead;
    - a couple getting a 404 on `/admin`;
    - a 3-row CSV with one new row, one duplicate and one rejected.

    Programs the test imports have source `e2e-import` and are removed by
    `e2e-reset.sql`.

## Phase 9: Polish, accessibility, deploy prep

93. **Map of the whole list** (`/app/map`, linked from the final list).
    - Each pair is a line between the two programs, styled by band: colour *and* line
      style (solid, dashed, dotted), so colour is never the only signal.
    - Partner A's programs are filled dots, partner B's are rings.
    - It shows the top 25 pairs by default (10, 25, 50, 100 or all). Bands can be
      hidden. Picking a pair, on the map or in the list beside it, highlights it.
    - The list beside the map is also the text alternative for screen readers.
    - No Match pairs, and pairs with a program that has no location, are counted under
      the map instead of drawn.
94. **Activity feed** (`/app/activity`, header icon). It shows the audit events from
    Phase 4 in plain words.
    - Events by the same person, of the same kind, within 30 minutes are merged into one
      line ("You reordered your list (25 changes)"), because autosave records many
      events.
    - Changes made by someone outside the couple can only be an admin merging duplicate
      programs, and they're described that way.
    - It shows the latest 500 events.
95. **Account page** (`/app/account`, header icon; sign-out moved here from the header).
    It shows your details and lets you leave the couple or delete your account (type
    DELETE to confirm).
    - Leaving uses the existing `leave_couple` and warns that the couple's data is
      deleted after 30 days.
    - The partner who stays sees a note on the setup page.
    - **Simpler than the spec:** an ended couple is *kept* for 30 days but there's no
      screen to view it read-only. The wording says "kept", not "read-only", and tells
      people to download a PDF or CSV before leaving.
96. **Accessibility pass.** axe checks every page (18 of them) in light and dark mode.
    It found no contrast problems. It did find two issues, both fixed:
    - **Maps were marked as images but contained the zoom buttons.** They're now
      labelled regions.
    - **The "Added" buttons were announced as "Remove …".** Speech-control users say
      the words they see, so the name must include them. They're now "Added: remove …".

    Also added a skip link, a `main` landmark on every page, and support for
    reduced-motion settings. The keyboard drag sensor dates from Phase 5.
97. **Landing page.** Added a six-step "How it works", matching the app's steps. I
    dropped a time estimate ("about an hour"), because nothing backs it up.
98. **Security headers** on every response:
    - a content security policy allowing only the app itself, its Supabase project
      (HTTPS and websockets) and the map tiles;
    - `frame-ancestors 'none'`, nosniff, a strict referrer policy, and camera,
      microphone and location switched off.

    Next needs inline scripts for hydration, so `'unsafe-inline'` stays. A
    nonce-based policy would force every page to render dynamically; revisit if needed.
99. **Deploy prepared, not done.** Deploying needs the co-founders' Vercel account, and
    for a commercial product Vercel's paid plan (Hobby is non-commercial only). Per the
    rule "ask before anything that costs money", `docs/deploy.md` lists the steps and
    costs instead.
    - `APP_URL` falls back to Vercel's production address.
    - A production build (`next build && next start`) was checked: it serves the
      security headers, has no console errors, and has no test sign-in.

## The NRMP Main Match program list

100. **Source:** the NRMP Main Residency Match Program Directory, saved and parsed on
     branch `claude/blissful-davinci-wyvz59` (merged here; `nrmp-directory/`). The owner
     approved its use (`docs/data-sources.md`).
101. **One program per NRMP track.**
     - Codes: in R3 a couple ranks codes, and a program can have several tracks
       (categorical, preliminary, advanced, physician-only, primary care, and extra
       tracks such as C1). So each track is its own program, `id = nrmp-<code>`, with
       its official code.
     - **Names:** "Institution — Specialty", plus a label where needed:
       "(Advanced)", "(Physician only)", "(Primary care)", "(Preliminary)", "(track 2)".
       The institution is the directory's own abbreviated name ("MGB-Massachusetts Gen
       Hosp"), minus the trailing "-City-ST".
     - **Specialties:** preliminary Internal Medicine and Surgery tracks go under the
       existing "Internal Medicine - Preliminary" and "Surgery - Preliminary"
       specialties, because that's how applicants look for them.
     - **Codes are 9 or 10 characters.** The directory has 10-character codes for a
       program's 11th track onwards (e.g. `2978140C10`). The code check in `rules.ts`
       and the database rule on typed codes now accept both.
102. **Only rankable tracks.** Active and Initial are loaded; Withdrawn (211) and Not
     Participating (185) are left out, giving 7,096 programs. "Initial" tracks haven't
     been activated yet, but usually will be before rank lists are due.
103. **Specialties.** The directory has 49 specialty names. 25 were added to the
     vocabulary: mostly combined programs such as "Emergency Medicine/Internal
     Medicine", plus a few smaller ones (Nuclear Medicine, Medical Genetics, and so on).
     Five more were alternative spellings of specialties we had.
104. **The official NRMP code wins.**
     - When a program has a code from the directory, that's the code on the final list,
       CSV and PDF, even if one was typed by hand.
     - The rank page shows it read-only. The typing box remains only for programs
       without one (couple-added ones).
     - So the "codes entered for every program" checklist item passes by itself for
       directory programs.
105. **Locations are city-level.**
     - The directory has city and state, no street address. Each of its 983 cities was
       looked up once on OpenStreetMap (allowing Puerto Rico) and saved in
       `packages/data/seed/nrmp-cities.json`.
     - The directory has 37 bad city values: typos ("Cincinnnati", "San Franciso"), a
       phone number, a room number, ".". They're corrected in a table in
       `nrmp-directory.ts`, using the program name where the city itself was junk
       (Yale → New Haven). That leaves 950 cities, all found. Each match was checked to
       be in the right state.
     - These locations are stored with confidence 0.5 (city centre).
     - Distance bands start at 30 miles ("together"), so city-level is enough for
       between-city trade-offs. Two programs in the same city count as 0 miles apart.
     - **Exact positions where we have them:** each seed program was matched by hand to
       its NRMP track (`seed/nrmp-seed-map.json`, 56 of 57). Its address is then used
       for *every* track at that institution in that city. That covers 696 tracks at
       big academic centres.
     - Admins can still fix any location by hand in Review, and a re-import keeps it.
106. **Seed programs are merged into their NRMP tracks** (`merge_programs`), so anyone who
     had listed one keeps their place, answers and codes. Boston Medical Center
     Pediatrics has no categorical track in the directory and stays as it was.
107. **Directory programs count as verified.** They're official, so they go straight into
     search for everyone and don't wait in the admin queue.
108. **Loading.** `nrmp:load` signs in as an admin and saves through `import_programs` in
     batches of 1,000. That's the same admin-only path as the CSV screen, with no
     service key. Migration 8 adds `nrmp_code` to it.
     - Re-running after a new directory export updates programs in place.
     - It was run with the admin test account; any admin account works.
109. **Search** now has to cope with thousands of programs and the directory's
     abbreviations:
     - each word must match, and common words also match their abbreviations
       (General → Gen, Hospital → Hosp, University → Univ, Medical → Med, Center → Ctr);
     - NRMP codes match too;
     - there's a state filter;
     - it shows "Showing 60 of 1,327" when there are more.
110. **Not done:** fellowship (SMS) programs. The directory export is Main Match only.
     Supplemental lists for advanced programs (the preliminary year to go with an
     advanced position) aren't modelled. Couples can rank preliminary and advanced
     tracks as separate programs.

111. **Supabase publishable key instead of the legacy `anon` key.**
     - Supabase retires the JWT-based `anon` and `service_role` keys at the end of 2026.
       Their replacement, the publishable key, has the same low privileges (row level
       security applies) and can be rotated on its own.
     - The app (browser, server and proxy) and the `nrmp:load` script now read
       `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. There's no fallback to the old variable:
       a missing key fails loudly instead of quietly using a legacy one.
     - The `send-invite` function reads `SUPABASE_PUBLISHABLE_KEYS.default`. It keeps
       the platform's JWT check, because it's called with the user's own session token,
       not with an API key.
     - We have no `service_role` key anywhere, so there's no secret key to migrate.
     - Once the deployed app uses the new key, the legacy keys can be switched off under
       Settings → API Keys. That's reversible.

## Bug-log fixes (November 2026)

112. **Moot comparisons are never asked** (bug log #9–#11). Take (a1, b1) and (a2, b2)
     where the partners are at different programs in each. If both pairs are reachable
     in the Match, partner 1 can get a1 and partner 2 can get b2, so the "swapped"
     pair (a1, b2) is reachable too, and likewise (a2, b1). If a swapped pair sits above
     both, the Match stops there first, and the order of the two never decides the
     outcome.
     - "Above" means a hard rule, or above in the current list with ≥ 90% model
       confidence (`MOOT_CONFIDENCE`). Hard rules alone wouldn't cover the case in the bug
       log: Hopkins–Penn is farther apart than Hopkins–X, so no rule puts it on top.
     - Pairs that share a program have no swapped pair and stay askable. An excluded
       swapped pair doesn't count, so the question comes back.
     - It's an approximation: it assumes whether you can get a program doesn't depend
       on your partner's outcome.
     - List confidence counts a moot neighbour as settled.
     - Benchmark (`pnpm --filter @pairwise/engine bench`), counting only orderings that
       can change the outcome: 0.974 → 0.970 after 40 questions, within noise. The old
       all-orderings figure fell from 0.962 to 0.943, as expected: it scores the moot
       orderings the engine no longer asks about. The bench now prints both.
113. **Drags land where they were dropped.** A drag pin used to say only "above", so a pair
     dragged up stayed behind everything that scored higher, and the target was pushed
     down to it instead. Pins now record which pair was moved (`pins.moved_pair`), and
     `rankPairs` replays the drags in the order they were made, each on the list as it
     stood just before it:
     - dragged up: the pair takes the target's place; the rows in between move down one;
     - dragged down: it lands right below the target; the rows in between move up one;
     - pairs that must stay above it by a hard rule come along.
     Older pins (no `moved_pair`) still constrain the order but aren't replayed.
114. **No Match rows end the list in a fixed order** (#15) while "No Match at the bottom"
     is on: partner 1 matches and partner 2 doesn't, in partner 1's order (1–NM, 2–NM, …),
     then the reverse (NM–1, NM–2, …). No Match–No Match is never a candidate. Their model
     scores no longer order them.
115. **Short program names** (#14) are derived from the full name
     (`packages/data/src/short-name.ts`): a table of well-known institutions (Hopkins, MGH,
     UCSF…), filler words dropped, and resident abbreviations for specialties (IM, Ortho,
     Plastics…). `programs.short_name` overrides it where an admin sets one. Used where
     space is tight (cards, the map, the final list's side panel); the full name stays in
     exports and print.
