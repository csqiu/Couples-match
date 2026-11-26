/**
 * The public guides (getpairwise.app/guides). Written and edited as Claude Docs, then
 * copied here as Markdown, with links between guides pointing at /guides/<slug>.
 * To update one, edit the text below (or re-copy it from the doc) and deploy.
 */

export interface Guide {
  slug: string;
  title: string;
  /** One sentence for the index page and search results. */
  description: string;
  /** ISO date of the last substantive edit. */
  date: string;
  body: string;
}

/** Shown under each guide's title. */
export const GUIDE_AUTHOR = 'Cecil Qiu, MD';

const HOW_IT_WORKS = '/guides/how-the-couples-match-works';
const WHY_HARD = '/guides/why-making-a-couples-list-is-hard';
const SHOULD_I = '/guides/should-i-couples-match';
const TELL_PROGRAMS = '/guides/should-i-tell-programs';
const HOW_TO_USE = '/guides/how-to-use-pairwise';
const DONATE = 'https://buymeacoffee.com/cecilqiu';

const IN_TRAINING = 'https://in-training.org/couples-matching-for-the-uncommitted-21933';
const NRMP_COUPLES = 'https://www.nrmp.org/intro-to-the-match/the-match-algorithm/couples-in-the-match/';
const NRMP_FEES = 'https://www.nrmp.org/match-fees/';

export const GUIDES: Guide[] = [
  {
    slug: 'about-us',
    title: 'About Us',
    description: 'Why we built Pairwise: our own couples match, a 300-row list built by hand, and a tool to make it simpler for other couples.',
    date: '2026-11-26',
    body: `I'm Cecil. In 2019, I talked my then-girlfriend, Arianna, into couples matching with me. She was skeptical. She wasn't ready to compromise her career for me, and I didn't want her to. But I was a math major before medical school, and I worked out how to build our list so that neither of us would match anywhere worse than if we'd applied on our own. The only difference would be ending up closer together.

It worked. We matched at Johns Hopkins and Penn, a short drive apart. Today Arianna and I are married.

Getting there wasn't easy. We built the list by hand, row by tedious row, and I made a simulator in Excel to check that it said what we actually wanted. I've wanted to build something better for other couples ever since.

The hard part isn't making a list. It's making one that reflects what you both truly want, without hundreds of head-to-head comparisons. That's what Pairwise does.

Pairwise is free, and I hope to keep it that way. If it helps you, we'd be grateful for a donation. It goes toward our daughter's birthday fund ◡̈

[☕ Buy me a coffee](${DONATE})
`,
  },
  {
    slug: 'how-to-use-pairwise',
    title: 'How to Use Pairwise',
    description: 'The six steps from setup to a list ready for R3, how to use tiers, and what Pairwise does for you.',
    date: '2026-11-26',
    body: `Pairwise turns your two rank lists into one couples list you can enter in R3. Setup takes a few minutes, everything saves as you go, and you can change anything later. The quickest way to learn it is to start.

## Get started

The six steps run across the top of the app. Finish setup first and the rest open up; you can go back to any step at any time.

1. **Setup.** Pick your specialty and match year, then invite your partner by email or with a link. You can add programs while you wait for them to join.
2. **Programs.** Search by name, city or NRMP code, and add every program you'd be willing to go to.
3. **Rank.** Drag your programs into order and sort them into Tiers A, B and C (below). Add each program's NRMP code from R3 when you have it.
4. **Compare.** Answer "this or that": pick the pair you'd rather match into, or call it too close to call. Watch List confidence rise, and stop whenever the list looks right. This opens once you've both ranked programs.
5. **Conflicts.** If answers go in a circle, or the two of you answered differently, they show up here and you choose what gives way.
6. **Final list.** Read your list, drag any row to move it, and check it on the map. Save a version, then export it as CSV or Print / PDF.

## Sort your programs into tiers

Tiers tell Pairwise how much each program matters to you compared with being near your partner. Your partner sees your tiers unless you turn on private tiers in setup.

| Tier | What it means |
| --- | --- |
| **A** | "Almost no amount of distance would make me drop to Tier B." |
| **B** | "Most of my programs. I would be willing to change my preferences within this tier to be with my partner" |
| **C** | "My least favourite programs. I'd rather be long distance than match here." |

Quick tips:

- **Put most programs in Tier B.** Your order there is respected, but can shift to keep you closer together.
- **Use Tiers A and C sparingly.** Most people have only a few programs in each, if any.
- **Leave off programs you wouldn't attend.** You can't match at a program that isn't on your list.
- **Your list is yours.** If you leave a couple, your ranks and tiers are saved and come back with you.

## What Pairwise does for you

Pairwise builds every possible pair of your programs and puts them in order. A few rules always hold:

- A pair that's at least as good for both of you, and no farther apart, goes higher.
- A Tier A program for you goes above pairs that don't have one.
- No Match pairs go last.
- Your "this or that" answers, and any row you drag, stay put.

For everything else, Pairwise learns from your answers how you trade distance against program quality. Pairwise doesn't predict your odds or try to game the Match. Your true order of preference is the best list ([why](${HOW_IT_WORKS})), and Pairwise helps you write it down. Tap the info button on any row of the final list to see why it's there.

## Before you enter it in R3

The "Before you certify in R3" checklist on the final list confirms that every program has its NRMP code, No Match pairs are at the bottom, no conflicts are left and the list fits NRMP's 300-rank limit. When it's all ticked, enter the list in R3 exactly as shown.

## Further reading

- [How the Couples Match Works](${HOW_IT_WORKS})
- [Why Making a Couples List Is Hard](${WHY_HARD})
- [Should I Couples Match?](${SHOULD_I})
- [Should I Tell Programs That I'm Couples Matching?](${TELL_PROGRAMS})
`,
  },
  {
    slug: 'how-the-couples-match-works',
    title: 'How the Couples Match Works',
    description: 'How the NRMP algorithm reads a couple’s list, and why some changes to a list make no difference to where you match.',
    date: '2026-11-25',
    body: `The NRMP gives a couple the highest row on their list where both partners can get in, so the best list is your true order of preference. Writing an error-free couples list that reflects those preferences, though, is easier said than done. This guide explains how the Match reads a couple's list, why some changes to a list make no difference to where you match, and how Pairwise takes the guesswork out of making your list.

Pairwise is not affiliated with the NRMP. For the official rules, see [Couples in the Match](${NRMP_COUPLES}).

## Notation

This guide uses light mathematical notation to keep things precise:

- **Partners.** Partner 1 and Partner 2, the two of you applying as a couple.
- **Programs.** A capital letter with the partner's number as a subscript. A₁, B₁, C₁, … are programs on Partner 1's list, and A₂, B₂, C₂, … are on Partner 2's. Each label is one program in one specialty.
- **Labels say nothing about place.** A₁ and A₂ are different programs, at different institutions, unless we say otherwise.
- **No Match.** NM₁ means Partner 1 goes unmatched, and NM₂ means Partner 2 does.
- **Each partner's options.** P₁ = {A₁, B₁, C₁, …, NM₁} for Partner 1, and P₂ = {A₂, B₂, C₂, …, NM₂} for Partner 2.
- **Rows.** A row of your list is an ordered pair such as (A₁, B₂): Partner 1's program first, Partner 2's second.

Each partner's reachable programs are the ones where they would get a position if they applied on their own, as an individual applicant. We write these sets as F₁ ⊆ P₁ for Partner 1 and F₂ ⊆ P₂ for Partner 2. No Match is always reachable: NM₁ ∈ F₁ and NM₂ ∈ F₂.

The box of two sets S and T, written S × T, is every ordered pair whose first term comes from S and whose second comes from T (their Cartesian product). Laid out as a table, with S down the side and T across the top, these pairs fill a rectangle, hence the name.

## How the Match works for one applicant

The NRMP uses the Roth–Peranson algorithm. Applicants apply down their lists, and programs hold on to the best applicants they have seen so far.

1. Each applicant applies to the first program on their rank list.
2. A program tentatively holds the applicants it ranks highest, up to its number of positions. Everyone else is turned down.
3. If a better-ranked applicant arrives later, the program bumps the weakest applicant it holds.
4. An applicant who is turned down or bumped applies to the next program on their list. Nobody ever moves back up their list.
5. When nobody is left to move, every tentative hold becomes the final match.

## How the Match works for a couple

A couple matches together on one row of their list, or not at all. They are never split across rows.

A couple submits one list of up to 300 rows. Each row is an ordered pair (A₁, B₂) from P₁ × P₂. Either side can be No Match: NM₁ or NM₂ means that partner goes unmatched in this row. Leave (NM₁, NM₂) off your list: both of you going unmatched is what happens anyway when no row works.

- **A row works only if both partners are held at the same time.** No Match always works for that partner, because it needs no position.
- **If either partner is turned down,** the other partner's application is withdrawn too, and the couple tries the next row.
- **If one partner is bumped later,** the other partner gives up their spot as well. That spot can go to someone else. The couple then carries on from the next row.
- **A couple never moves back up their list,** just like a single applicant.

## The simple way to think about it

You match on the first row of your list where both of you are within reach.

On Match Day, Partner 1 can get into the programs in F₁ and Partner 2 into those in F₂, the reachable programs defined above.

Read your list from the top. Your match is the first row (A₁, B₂) with A₁ ∈ F₁ and B₂ ∈ F₂ (∈ means "is in").

Nobody knows F₁ or F₂ in advance, not you and not any tool. So your list has to give the right answer whatever they turn out to be. The only list that does that is your true order of preference.

> A useful consequence: write out the box of your two rank lists, P₁ × P₂, going down one partner's list in order and, for each of their programs, down the other partner's list in order. Each of you then matches exactly where you would have as an individual. So a couples list never has to do worse than applying separately (as long as all combinations fit in 300 rows). This is why we encourage couples to couples match even if they aren't engaged or married.

## The complication: when two lists give the same result

Two different lists can always put you in the same place. We call them **equivalent**: whatever F₁ and F₂ turn out to be, both lists give the same match.

> This is why creating a couples list is difficult. Some changes to your list don't actually make a difference in your outcome, and the moves you make on your list may not have the intended effect. Lists get messy quickly.

<span id="two-orders"></span>The simplest example of two equivalent lists is the box P₁ × P₂ written out in two different orders. In the table, each partner has two programs. List 1 goes down Partner 1's list and, for each of Partner 1's programs, down Partner 2's list. List 2 does the reverse. The rows come in a different order, yet both lists match each of you exactly where you would match as individuals.

| Rank | List 1: Partner 1's list first | List 2: Partner 2's list first |
| --- | --- | --- |
| 1 | (A₁, A₂) | (A₁, A₂) |
| 2 | (A₁, B₂) | (B₁, A₂) |
| 3 | (A₁, NM₂) | (NM₁, A₂) |
| 4 | (B₁, A₂) | (A₁, B₂) |
| 5 | (B₁, B₂) | (B₁, B₂) |
| 6 | (B₁, NM₂) | (NM₁, B₂) |
| 7 | (NM₁, A₂) | (A₁, NM₂) |
| 8 | (NM₁, B₂) | (B₁, NM₂) |

### The box

Take two rows, X = (A₁, B₂) and Y = (C₁, D₂). Their *box* is {A₁, C₁, NM₁} × {B₂, D₂, NM₂}, the nine pairs below:

| Partner 1 ↓ · Partner 2 → | B₂ | D₂ | NM₂ |
| --- | --- | --- | --- |
| **A₁** | **X = (A₁, B₂)** | (A₁, D₂), a cross pair | (A₁, NM₂) |
| **C₁** | (C₁, B₂), a cross pair | **Y = (C₁, D₂)** | (C₁, NM₂) |
| **NM₁** | (NM₁, B₂) | (NM₁, D₂) | (NM₁, NM₂), never a row |

If X and Y are both reachable, then A₁, C₁ ∈ F₁ and B₂, D₂ ∈ F₂. So every pair in the box has both sides reachable too.

### Swaps that make no difference

**If any pair from the box sits above both X and Y, their order doesn't matter.** Whenever both are reachable, the Match stops at that higher row first.

Example. Partner 1 is choosing between A₁ and C₁, and Partner 2 between B₂ and D₂:

1. (A₁, D₂)
2. (A₁, B₂)
3. (C₁, D₂)

Swapping rows 2 and 3 changes nothing. Both are reachable only if A₁ ∈ F₁ and D₂ ∈ F₂, and then row 1 works first. Otherwise at most one of them is reachable, and their order decides nothing.

The opposite also holds. When no pair from the box sits above X and Y, their order *does* matter: in some outcome it decides where you match.

### The full test

Two lists are equivalent if, and only if, they pass this test: take any rows X and Y from either list (X and Y can be the same row). The first row on each list that falls in their box, counting X and Y themselves, must be the same. Checking rows two at a time is enough, because any difference between two lists shows up in one of these comparisons.

## Where the simple picture is not exact

The reachable-programs picture is very close to how the Match behaves, with two exceptions.

- **Both partners at the same program.** Sometimes A₁ and A₂ are the same program, for example when you both apply to one internal medicine residency. The row (A₁, A₂) then needs two open positions there at once, and A₁ ∈ F₁ and A₂ ∈ F₂ separately don't guarantee that. So a row like this can't be counted on to make another comparison irrelevant.
- **Knock-on effects.** When a couple gives up one partner's spot, someone else can get in, which can shift other results. In theory this means what is reachable can depend slightly on the lists themselves. Across the whole Match this effect is small, and the NRMP's advice stays the same: rank your true preferences.

## What this means for your list

Couples who want the best chance of matching, including options where they would be long distance, face a hard list. It is unreasonable to ask anyone to picture nearly 300 outcomes, let alone put them in order. And each partner's preferences shift depending on where the other could end up.

Using the logic of the Match algorithm, Pairwise builds a list that reflects a couple's preferences from a much smaller set of key comparisons, and focuses on getting those right.

- **Rank honestly.** You can't know what will be reachable, so guessing or "playing safe" can only cost you.
- **Pairwise skips comparisons that don't matter.** If a pair from the box already sits above two rows, it won't ask you to choose between them.
- **Pairwise warns about rows that can never be reached.** This can happen when you move No Match rows up from the bottom of the list. Those rows waste space and can add fees.
- **Pairs at the same program are treated with care.** Pairwise never assumes both of you can get into one program just because each of you could alone.
`,
  },
  {
    slug: 'why-making-a-couples-list-is-hard',
    title: 'Why Making a Couples List Is Hard',
    description: 'Why the list grows so fast, the mistakes couples make most often, and what Pairwise does about each one.',
    date: '2026-11-25',
    body: `A couples list is hard because it asks two people to put hundreds of joint outcomes in order, and the Match punishes small mistakes without warning. Most of those mistakes only show up on Match Day, when it is too late to fix them. This post covers why the list gets big so fast, the mistakes we see most often, and what Pairwise does about each one.

It builds on [How the Couples Match Works](${HOW_IT_WORKS}) and uses the same notation: A₁, B₁, … for Partner 1's programs, A₂, B₂, … for Partner 2's, and NM for No Match.

## The list grows faster than you think

Every program on one partner's list can pair with every program on the other's, plus No Match on either side. If Partner 1 ranks n₁ programs and Partner 2 ranks n₂, the number of possible rows is:

<p class="formula">(n₁ + 1)(n₂ + 1) − 1</p>

The −1 drops (NM₁, NM₂), which is never a row. With 10 programs each that is 120 rows. With 16 each it is 288, just under the NRMP's limit of 300. With 17 each it is 323, and with 20 each it is 440, so most couples cannot list every combination and have to choose which ones to leave off.

Numbers are only half the problem. Each row is a whole future for two people: two programs, two cities, and the distance between them. Ranking 300 of those by hand means making tens of thousands of implicit comparisons, and it is easy for some of them to contradict each other.

## What can go wrong

None of these mistakes is unusual, and none of them shows up until results come out.

| Mistake | What happens on Match Day |
| --- | --- |
| **No rows where one partner goes unmatched** | If Partner 2 cannot get into any program paired with Partner 1's reachable programs, you both go unmatched, even though Partner 1 could have matched alone. |
| **No Match rows placed high** | Every later row that gives that partner the same program can never be reached. You have also chosen being apart over every pair below it. |
| **Cutting the list to fit 300 rows from the bottom** | The No Match rows usually sit at the bottom, so they are the first to go. They are your safety net. |
| **Ranking by odds instead of preference** | Moving a "safer" pair up never helps. If both pairs are reachable, you get the one you like less; if only one is, its position made no difference. |
| **Spending time on swaps that change nothing** | If (A₁, D₂) already sits above (A₁, B₂) and (C₁, D₂), the order of those two can never matter. The time is wasted, and it gives a false sense of control. |
| **A drag that moves more than you meant** | Moving one row up ten places changes its order against all ten rows it passes, not just the one you were thinking about. |
| **Preferences that go in a circle** | You agree on X over Y one evening, Y over Z the next, and Z over X a week later. No list can honour all three, so one is broken by whoever edited last. |
| **Counting on both of you at the same program** | If you are applying into the same specialty, matching at the same program requires two open positions there at once. Each of you being able to get in alone does not guarantee it. |
| **Wrong or repeated NRMP codes in R3** | A mistyped code ranks a different program or track. A repeated row can never be reached and only takes up space. |

## How Pairwise helps

Pairwise turns the list into a few dozen comparisons that need to be made, then builds the list from your answers and checks it before you type it into R3.

- **You rank your own programs, not 300 pairs.** Each of you orders your programs and sorts them into tiers. Pairwise builds every possible pair from those two lists and works out how far apart each pair is.
- **It asks only the comparisons that matter.** Questions such as "both at your #1 programs on opposite coasts, or both at your #4 programs in the same city?" teach it how you trade distance against program quality. It skips any comparison whose order can never change where you match.
- **It follows rules no score can break.** A pair that is at least as good for both of you, and no farther apart, always ranks higher. Rows where you both match come before rows where one of you does not.
- **It catches preferences that go in a circle** and shows you, in plain language, which answers conflict so you can decide.
- **Every drag is explained.** You can move any row, and Pairwise tells you why one row sits above another, or which rule a move would break.
- **It checks the list before you submit.** It warns when the list runs past 300 rows, when a row can never be reached, when No Match rows are not at the bottom, and when an NRMP code is missing. It exports a checklist, PDF and CSV for entering the list in R3.

Pairwise does not predict your odds or try to game the Match. Your true order of preference is the best list, and its job is to help you write that order down correctly.

## Further reading

- [How the Couples Match Works](${HOW_IT_WORKS}): the algorithm, and why some changes to a list make no difference.
- [Should I Couples Match?](${SHOULD_I}): why couples who aren't engaged or married should still consider matching together.
- [Couples in the Match](${NRMP_COUPLES}), from the NRMP.
`,
  },
  {
    slug: 'should-i-couples-match',
    title: 'Should I Couples Match?',
    description: 'Engaged, dating or married: how to couples match without matching anywhere worse than you would alone, and what you gain by doing it.',
    date: '2026-11-26',
    body: `For some couples, the list is easy. If you're married with kids, you will probably rank only pairs of programs close to each other. Being apart isn't an option, so the only question is which city.

Most medical school couples are somewhere short of that: engaged, seriously dating or newly dating. You can still couples match, and you can do it without matching anywhere worse than you would have applying on your own (apart from the NRMP's couples fee). A couples list lets you say something two separate lists can't: that your preferences depend on where your partner lands. Pairwise helps you build that into your list.

Here is my own example. On my own, Johns Hopkins was my top choice. But if Arianna - my serious girlfriend at the time - could match at UCSF, I would have given that up and ranked Stanford above Hopkins to be near her. Applying separately, I had no way to say "Stanford, but only if Arianna gets UCSF." On a couples list it is one decision: put (Stanford, UCSF) above (Hopkins, UCSF).

That is why I think every couple applying in the same year should consider the couples match, whatever stage you're at.

This post makes that argument carefully. It uses the notation from [How the Couples Match Works](${HOW_IT_WORKS}): A₁, B₁, … for Partner 1's programs, A₂, B₂, … for Partner 2's, NM for No Match, and F₁, F₂ for the programs each of you could get into.

## Where this started

In 2021, my wife Arianna and I wrote [Couples Matching for the Uncommitted](${IN_TRAINING}) for in-Training, about our own couples match. We had been dating for three years and were applying in dermatology and plastic surgery, two competitive fields. We were not ready to give up much in our careers for each other, and deciding to match together felt like deciding whether to spend our lives together.

We found a middle path. We applied and interviewed as the best individual applicants we could be, and decided to match together only after comparing our interviews. At the top of our list were pairs of top programs a few hours apart. After those, our list split apart: Partner A's #1 program paired with each of Partner B's programs in turn, then Partner A's #2, and so on. We both matched at programs we loved, a short drive apart.

Two things from that experience stayed with me. Building the list by hand was hard: ours ran to the full 300 rows, and we ran simulations to make sure a miscalculation would not decide our future. And the structure we stumbled into turns out to have a precise property, which the rest of this post explains. I have wanted to build a tool that does this properly ever since. Pairwise is that tool.

## Why it can cost nothing

Start with what I'll call the **baseline list**, built from your two individual rank lists:

1. Every pair where you both match, in Partner 1's order: Partner 1's #1 program with each of Partner 2's programs in Partner 2's order, then Partner 1's #2 with each of Partner 2's, and so on.
2. Then (A₁, NM₂), (B₁, NM₂), … in Partner 1's order.
3. Then (NM₁, A₂), (NM₁, B₂), … in Partner 2's order.

**With the baseline list, each of you matches exactly where you would have matched alone**: Partner 1 at their best program in F₁, and Partner 2 at their best program in F₂. There are four cases.

- **Both of you can match somewhere.** Say A₁ is Partner 1's best program in F₁ and B₂ is Partner 2's best in F₂. Every both-match row above (A₁, B₂) either gives Partner 1 a program they like more than A₁, which is out of reach, or pairs A₁ with a program Partner 2 likes more than B₂, which is also out of reach. So (A₁, B₂) is the first row that works.
- **Only Partner 1 can match.** No both-match row works. The first row that does is (A₁, NM₂).
- **Only Partner 2 can match.** No row in parts 1 or 2 works, and the first that does is (NM₁, B₂).
- **Neither of you can match.** No row works, and you both go unmatched, as you would have alone.

The No Match rows sit at the bottom, as the NRMP recommends. Ordering the both-match rows in Partner 2's order instead gives the same result; the guide has [a table of the two orders](${HOW_IT_WORKS}#two-orders). Apart from the few pairs of top programs we moved to the top, it is the list from our 2021 article.

The one requirement is room. If Partner 1 ranks n₁ programs and Partner 2 ranks n₂, the baseline list has n₁n₂ + n₁ + n₂ rows, which must fit in the NRMP's 300. With 16 programs each that is 288 rows.

## What you gain

The baseline list is a floor. From there, one rule keeps the couples match free of cost:

> **Move a row up only if both of you would rather have it than every row it jumps over.** Then, whatever programs turn out to be reachable, each of you ends up somewhere you like at least as much as before.

Why: moving row X up changes your match only when X is reachable and one of the rows it jumped over would otherwise have been your match. You both prefer X to each of those rows, so you both prefer the new result. In every other case nothing changes.

What the rule buys you is preferences that depend on where your partner lands. Say Partner 1 likes A₁ more than B₁ on its own, but would rather be at B₁ if Partner 2 is at B₂ in the same city than at A₁ across the country from B₂. Partner 2, at B₂ either way, would rather be near Partner 1. Moving (B₁, B₂) above (A₁, B₂) makes you both better off whenever it matters. Applying separately, neither of you can say "B₁, but only if my partner gets B₂." A couples list is the only place you can say it.

When you disagree, because one of you would give something up for the other, you don't have to move anything. That trade is the decision a committed couple makes, and an uncommitted couple can simply decline it.

## Where "no cost" is not exact

The argument holds as stated in the model from the guide. Four things can bend it.

- **Not enough room.** If the baseline list runs past 300 rows, some pairs have to go. Drop a both-match pair (A₁, B₂), and if those turn out to be your two best reachable programs, the list falls through to a lower row: one of you may end up somewhere worse, or unmatched where you would have matched alone. If you must cut, cut pairs that sit near the bottom of both your lists, and never the No Match rows. Uneven lists fit more easily: 25 programs and 10 programs make 285 rows.
- **Both of you at the same program in the same specialty.** Matching at the same program needs two open positions there at once, so it can turn out differently from two separate applications.
- **Knock-on effects.** When a couple gives up one partner's spot, someone else can take it, which can shift results elsewhere. In theory, what is reachable can depend slightly on everyone's lists. Across the whole Match the effect is small.
- **Fees and effort.** The NRMP charges an extra fee to match as a couple, and longer lists can cost more; check [Match Fees](${NRMP_FEES}) for the current amounts. Building the list also takes time and some honest conversations.

## How to do it

1. **Apply and interview as individuals.** Be the best applicant you can be, and form your own view of each program. You can decide to match together later, as we did.
2. **Each rank your own programs honestly.** These two lists are what the baseline is built from, so they should reflect what each of you wants on your own.
3. **Build the baseline list** and check that it fits in 300 rows. If it doesn't, cut pairs near the bottom of both lists, never the No Match rows.
4. **Move together-pairs up only by agreement.** For each pair you are tempted to move, ask each other: would you both rather have this than every row it jumps over? If both of you say yes, move it.
5. **Leave the hard trades for last, and decide them openly.** Anything that helps one of you at the other's expense is a real choice about your relationship, not a technicality.

Pairwise is built for steps 2 to 5. You each rank your own programs, it asks the comparisons where your answers change the list, and it checks the length, the No Match rows and the NRMP codes before you enter the list in R3.

## Sources

- Arianna Yanes and Cecil Qiu, [Couples Matching for the Uncommitted](${IN_TRAINING}), in-Training, February 16, 2021.
- NRMP, [Couples in the Match](${NRMP_COUPLES}).
- NRMP, [Match Fees](${NRMP_FEES}).
- Pairwise, [How the Couples Match Works](${HOW_IT_WORKS}) and [Why Making a Couples List Is Hard](${WHY_HARD}).
`,
  },
  {
    slug: 'should-i-tell-programs',
    title: 'Should I Tell Programs That I’m Couples Matching?',
    description: 'In competitive specialties with few spots, telling programs usually hurts. Why, when it can help, and what to say if asked.',
    date: '2026-11-25',
    body: `In a competitive specialty where each program takes only a few residents, telling programs you are couples matching usually hurts you, so by default I would not volunteer it. Programs tend to rank applicants they think are likely to come. Couples matching can only lower that likelihood in a program's eyes, and a department rarely gets anything in return for taking the risk.

This post explains why, when telling can help, and what to say if a program asks.

## How programs build their rank lists

The difficult truth is that programs rank applicants partly on how likely they are to come. A program does not want to "drop on its rank list": go far down it to fill its positions, or not fill at all. So an applicant who seems likely to rank the program highly often gets ranked higher than an equally strong applicant who seems likely to go elsewhere.

Strictly, the algorithm does not punish this. A program's ranking of you only matters if you end up applying to it during the Match, so ranking someone highly who goes elsewhere costs the program nothing; it simply moves on to the next name. But many programs behave as if it does cost them, and how far down the list they had to go is a number some programs watch closely. What matters for you is how programs act, not how the algorithm works.

This effect is strongest where each program has very few positions. A plastic surgery or dermatology program that takes two or three residents a year may fill its class from the top handful of names, and every one of those names is a judgement about who will actually come.

## Why couples matching looks like a risk

From a program's side, couples matching adds a condition to everything you say. Even if you rank the program first, you only match there on a row where your partner also gets in somewhere that works for both of you. If your partner doesn't, the Match moves down your list, and the program loses you to a row lower down. So telling a program you are couples matching can only lower its estimate of how likely you are to come.

It rarely buys anything in return. Departments build their rank lists separately. A plastic surgery program is not going to rank Cecil higher just because the dermatology program at the same institution really wants Arianna. Plastic surgery has its own few positions to fill, and the dermatology program's interest does not guarantee that Arianna matches there either, since Arianna is competing for a handful of spots too.

Put together, telling a small, competitive program moves its view of you in only one direction: down.

## When telling can help

One question decides it: **will this make the program more confident that you will come?** Usually the answer is no, but there are exceptions.

- **Your partner is very likely to land in the same city.** If your partner is applying in a large specialty with many positions nearby, "we are both aiming for this city" can read as a reason you will come, not a reason you might not.
- **The program is large.** In specialties where programs take many residents a year, one applicant's likelihood of coming matters less, and some institutions actively recruit couples.
- **Both departments want you, and the institution coordinates.** Some institutions do talk across departments about couples. If you know both programs are interested in each of you, telling them can help them rank you together. Don't assume this happens; most departments rank on their own.
- **It explains a real tie to the area.** If your partner is the reason you want to be in that city, saying so can make your interest more believable, even without the words "couples match."

## What to say if a program asks

You never have to tell a program how you will rank it or where else you are applying. The NRMP's rules limit what programs may ask about your other applications; read the current Match Participation Agreement before interview season.

What you say must be true. Misleading a program is unethical and can break the NRMP's rules. Within that limit, keep the answer about the program:

- "I'm weighing a few options with my partner in mind, and I would be very happy here."
- "Being in this city matters a lot to both of us." Say this only if it's true.
- "I'll rank you first." Say this only if it is true and you are sure of it. On a couples list, "first" means the rows with this program near the top, and you may not match there even then.

## Further reading

- [How the Couples Match Works](${HOW_IT_WORKS})
- [Why Making a Couples List Is Hard](${WHY_HARD})
- [Should I Couples Match?](${SHOULD_I})
- Arianna Yanes and Cecil Qiu, [Couples Matching for the Uncommitted](${IN_TRAINING}), in-Training, February 16, 2021
`,
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export { HOW_TO_USE };
