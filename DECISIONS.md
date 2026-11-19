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
