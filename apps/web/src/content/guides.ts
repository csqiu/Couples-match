/**
 * The public guides (getpairwise.app/guides). Written and edited as Claude Docs, then
 * copied here as Markdown, with links between guides pointing at /guides/<slug>.
 * To update one, edit the text below (or re-copy it from the doc) and deploy.
 * Retired guides redirect to the post that absorbed them (next.config.ts).
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

const ABOUT = '/guides/about-us';
const HOW_TO_USE = '/guides/how-to-use-pairwise';
const LOVE = '/guides/give-med-school-love-a-chance';
const TECHNICAL = '/guides/technical-guide-to-the-couples-match';
const DONATE = 'https://buymeacoffee.com/cecilqiu';

const IN_TRAINING = 'https://in-training.org/couples-matching-for-the-uncommitted-21933';
const NRMP_COUPLES = 'https://www.nrmp.org/intro-to-the-match/the-match-algorithm/couples-in-the-match/';

export const GUIDES: Guide[] = [
  {
    slug: 'about-us',
    title: 'About Us',
    description: 'Who we are, why we built Pairwise, and why it’s free.',
    date: '2026-11-26',
    body: `I'm Cecil. In 2019, I talked my then-girlfriend, Arianna, into couples matching with me. As a former math major, I worked out how to build our list so that, at best, we would match closer together, and at worst, neither of us would do worse than if we had matched separately. We matched at two of our favorite programs within driving distance (Johns Hopkins plastic surgery and Penn dermatology), and today we're married with a kid. Our full story is in [Give Med School Love a Chance](${LOVE}).

Building that list by hand took dozens of hours, an Excel simulator and at least a dozen resubmissions. Since then, I've helped many other med school couples navigate the Match. Pairwise turns what I learned into a tool that makes the process efficient and accurate. For the nerdy details, see [A Technical Guide to the Couples Match](${TECHNICAL}).

Pairwise is free, and I hope to keep it that way. Your personal information and rank lists will always be kept private. It has been a labor of love and geeky joy to create this tool. If it helps you, we'd be grateful for a donation. It goes toward our daughter's birthday fund ◡̈

[☕ Buy us a coffee](${DONATE})
`,
  },
  {
    slug: 'how-to-use-pairwise',
    title: 'How to Use Pairwise',
    description: 'The manual for Pairwise: every screen, from setup to a list ready for R3.',
    date: '2026-11-26',
    body: `This is the manual for Pairwise: what each screen does and how to get the most from it. It might help to keep this page open in a separate window while you use the app, and look up each screen as you reach it.

## 1. Setup

Setup is done once for each applicant.

- **About you.** Your name (shown to your partner), your match (the Main Residency Match or a fellowship match), your match year and your specialty. You and your partner must be in the same match. If you are dual-applying in the same match, just pick either one (this does not restrict the programs you can add to your list).
- **Invite your partner.** Send an invite to their email, or copy an invite link and send it yourself. They must sign in with the exact address you used. Sending a new invite or link cancels the previous one. You can start choosing programs while you wait for them.

### Couple settings

These are shared by both of you, and you can change them any time from **Edit setup** on the dashboard.

| Setting | Options |
| --- | --- |
| Answering "this or that" | **Together:** you answer each question as a couple. **Separately:** you each answer, and disagreements go to a discussion queue. |
| What your partner sees | **Everything:** you both see each other's programs and tiers. **Private tiers:** your tiers still shape the list, but your partner doesn't see them. |
| How far is "close"? | The miles for **Together** (or same metro), **Commutable** and **Drivable**. Anything beyond drivable counts as **Apart**. |

## 2. Programs

Add every program you'd be willing to go to. You'll put them in order next.

- **Search** by program name, city or NRMP code, and narrow by specialty or state.
- **Can't find a program?** Choose **Add a program not listed** and enter its name, hospital, specialty and street address. Only you and your partner see it. The address is how Pairwise works out distances, so a program saved without one can't be placed on the map.
- **Thinking about not ranking a program at all?** You can still include the program in this list; just be sure to remove it from your final rank list if you decide you don't want to go there at all.

## 3. The dashboard

After setup, the dashboard shows **Your lists**. Each list is a fresh start from your individual rankings and runs through four steps: Rank, Compare, Conflicts and Final list.

- **One list is open at a time,** marked **Open now**. Choose **Continue** to pick up where you left off, or open another list.
- **Start a new list** to try a different approach. Start the Rank step from **blank tiers**, or from **a saved version's tiers** and change what you like. Your programs, notes and NRMP codes carry over; your "this or that" answers, conflict choices and final-list settings don't. Your partner moves to the new list with you.
- **Saved versions** appear under each list. Star the ones that matter, **View** one, or **Compare** it with your current list.

The dashboard also links to **Edit programs** and **Edit setup**.

## 4. Rank and tier

Each of you puts your own programs in order and sorts them into three tiers. The tiers tell Pairwise how much each program matters to you compared with being near your partner.

| Tier | What it means |
| --- | --- |
| **A** | "Almost no amount of distance would make me drop to Tier B." Use sparingly. |
| **B** | "Most of my programs. I'd take a lower Tier B program to be closer to my partner." |
| **C** | "My least favourite programs. I'd rather be long distance than match here." Use sparingly. |

- **Drag** a program to reorder it, including into another tier, or use its up and down arrows.
- **Keyboard:** focus a program and press space or enter to pick it up, move it with the arrow keys, then press space or enter to drop it (escape cancels).
- **NRMP code:** type each program's code from R3 when you have it. The final list checks that every program has one.
- **Most programs belong in Tier B.** Your order there is respected, but can shift to bring you closer together. Most people have only a few programs in Tier A or C, if any.

## 5. This or that

Each question shows two pairs, with a map of where each of you would be and how far apart. Pick the pair you'd rather match into. There are no wrong answers: each one teaches Pairwise how much distance matters to you. This step opens once you've both ranked programs.

- **Too close to call:** you'd be equally happy with either.
- **Come back to this later:** the question is saved for later and asked again when the others run out. You can also flag it to talk through together.
- **List confidence** rises as you answer. Stop whenever your list looks right; when there's nothing useful left to ask, you'll see **No more questions for now**.

### Make a specific comparison

The questions above are chosen for you. To ask your own, choose **Make a specific comparison**. Click each plate to pick a program from that person's rank list (or No Match) for each side, and Pairwise shows:

- which of the two pairs your list puts higher;
- whether that order is set by a rule or something you told it, or only by the score;
- how many rows on your final list would move if you swapped them, and whether a swap would clash with what you've said.

Then **keep this order**, **swap** it, or call it **too close to call**. Your choice is saved as an answer. Use it for the comparisons you care most about, such as your top few pairs or a row that surprised you on the final list.

## 6. Conflicts

This step lists anything you've said that doesn't fit together, in plain language, and you choose what gives way. Pairwise never picks for you. When everything fits, you'll see **No conflicts**.

| You'll see | What happened | What you can do |
| --- | --- | --- |
| **These answers go in a circle** | Your answers or rules say A over B, B over C, and C over A. | Choose which link to drop, or remove an answer. Dropping a link affects only those two pairs. |
| **You answered differently** | In Separately mode, you and your partner picked different pairs. | Settle on one together, or call it too close to call. |
| **Still true?** | Pairwise is now fairly sure you'd answer an earlier question the other way. | **Yes, still true**, or **Actually, the other one**. Your answer holds until you change it. |
| **The move you just made** | A row you dragged on the final list clashes with something you set. | Keep the move and drop what it clashes with, or undo it. |

## 7. Final list

This is your couple's rank list, in order, ready to enter in R3.

- **Why is a row here?** Tap the info button on any row to see what puts it there: a rule, one of your answers, a row you dragged, or the score.
- **Drag a row** to move it. If the move goes against something you set, Pairwise says what, and you can override it. A move that clashes is kept where you put it, and the clash goes to the Conflicts step.
- **Not on your list** is a side panel of pairs that didn't make the list. Search it, then drag a pair in or add it. A pair you added can be taken off again.
- **List length** sets how many rows to include.
- **Show the list in** a different order: your order, your partner's, both ranks together, or the engine's own order. Many rows can trade places without changing where you match, and this uses that freedom to make the list easier to read. You match exactly the same way, and rows set by a rule, an answer or a drag never move.
- **No Match rows** are locked at the end of the list, as the NRMP recommends. You can unlock them to move rows among them.

The panels beside the list show:

- **Before you certify in R3:** a checklist confirming the list length, that each of you has entered an NRMP code for every program, that No Match pairs are at the bottom, that no conflicts are left, and that the list fits NRMP's 300-rank limit.
- **Fee estimate** for each of you.
- **What you're trading:** the main trade-offs your list makes between distance and program.
- **Save a version** with a name and an optional note.

## 8. Checking your list

### Try an outcome

This is the best test of whether your list says what you mean. Choose **Try an outcome**, tick the programs each of you could get into, and, for any program on both your lists, whether there's room for both of you at once. Pairwise marks the row you'd match on ("You match here"), the first row where both of you are within reach, and dims the rows that are out of reach.

Try the outcomes that worry you: one of you doesn't get your top choices, you only get into programs far apart, or one of you doesn't match at all. If a result surprises you, drag the row or make a specific comparison until it doesn't.

### Map, versions and exports

- **Map:** your final list on a map, with a control for how many pairs to show and filters for distance bands.
- **Versions:** frozen snapshots of your list. Rename them, compare any two to see which rows moved, print one, or restore one as your working list.
- **Print / PDF:** each partner's R3 entries in order, plus the checklist, laid out for typing into R3.
- **CSV:** the list as a spreadsheet file.

## 9. Working together

- **Answering together or separately** is a couple setting. Separately, you each answer "this or that" on your own, and any question you answer differently goes to Conflicts.
- **Private tiers** let each of you keep your tiers to yourself. They still shape the list.
- **Live presence:** when your partner is in the app, the header shows where they are, for example that they're resolving conflicts.
- **Activity** (the clock icon) lists what each of you has changed, newest first.
- **Privacy:** only you and your partner can see your lists, answers and versions.
- **Account:** edit your name or specialty, leave the couple, or delete your account. If you leave, your own program list (ranks, tiers, notes and codes) stays with you and comes along to your next couple. Programs the couple added by hand don't.

## 10. Behind the scenes

Pairwise builds every possible pair of your programs and puts them in order. A few rules always hold:

- **Common sense:** a pair that's at least as good for both of you, and no farther apart, goes higher.
- **Tier A:** a pair that gives you a Tier A program, while your partner matches somewhere, goes above pairs that don't.
- **No Match goes last:** every pair where you both match goes above every pair where one of you doesn't.
- **What you told it:** your "this or that" answers, and any row you drag, stay put.

For everything else, Pairwise gives each pair a score from program value (set by tier and rank), the cost of the distance between you (by distance band), and an equal weight for both of you. It learns how you trade distance against program quality from your answers, and it picks next the question whose answer would change the most rows near the top of your list.

Pairwise doesn't predict your odds or try to game the Match. Your true order of preference is the best list, and Pairwise helps you write it down without mistakes. For why, see [A Technical Guide to the Couples Match](${TECHNICAL}).

## Further reading

- [Give Med School Love a Chance](${LOVE}): why most medical school couples should couples match.
- [A Technical Guide to the Couples Match](${TECHNICAL}): how the algorithm reads your list, with the proofs.
- [About Us](${ABOUT})
`,
  },
  {
    slug: 'give-med-school-love-a-chance',
    title: 'Give Med School Love a Chance',
    description: 'Why most medical school couples, dating or engaged, should couples match, and how we did it.',
    date: '2026-11-26',
    body: `For some couples, the couples match is easy. If you're married with kids, you'll rank only pairs of programs close to each other. Being apart isn't an option, so the only question is which city.

Most medical school couples are somewhere short of that: engaged, seriously dating or even newly dating after meeting on a rotation. These couples would love to stay together, but they would also be willing to do long distance if it meant they would get great training.

The great news is that if you understand how the couples match algorithm works, you can carefully engineer a rank list that respects both your individual program preferences and your desire to be close to each other for residency. **Pairwise** makes engineering this list easier.

## Our story

In 2019, I talked my then-girlfriend, Arianna, into [couples matching with me](${IN_TRAINING}). We had been dating for three years and were applying in dermatology and plastic surgery. She was skeptical about couples matching. She wasn't ready to compromise her career for me, and I didn't want her to. Deciding to match together felt like deciding whether to spend our lives together.

We both had our own individual program preferences and our dream programs. But wherever Arianna ends up matching also affected my preferences, and vice versa. We were willing to make some rank list trade-offs if it meant we could be closer together. Being a former math major, I figured out how to encode these dependencies into our rank list.

Here is what a couples list let us do: On my own, Johns Hopkins was my top choice. But if Arianna could match at UCSF, I would have given that up and ranked Stanford above Hopkins to be near her. Applying separately, I would have had no way to say "Stanford, but only if Arianna gets UCSF." On a couples list it is one decision: put (Stanford, UCSF) above (Hopkins, UCSF).

We made sure that we had all combinations of our programs in relative rank order (including the possibilities of one of us not matching), so that we wouldn't end up any worse than matching as individual applicants.

You can imagine that, for every possibility of where Arianna might end up, the rank list of my programs was different. There was also the question of how to encode the *reverse* dependencies, where Arianna’s preferences change based on where I could end up. Doing this manually on our list of 300 program combinations got messy very quickly. It took us dozens of hours, an Excel simulator and at least a dozen list resubmissions to get it right. It totally consumed our pre-match vacation abroad, which was supposed to be stress-free. Since then, I've helped many other med school couples navigate the Match. Pairwise is the tool that I wish we had.

## Couples matching is no worse than individual matching

Start with a list built only from your two individual rank lists. Take your #1 program and pair it with each of your partner's programs, in your partner's order. Then do the same with your #2, your #3 and so on. Add the rows where only you match, then the rows where only your partner matches.

With that list, each of you matches exactly where you would have matched applying alone. The Match gives a couple the first row where both partners can get in, and this order makes that row your best reachable program paired with your partner's best. The proof is in [A Technical Guide to the Couples Match](${TECHNICAL}).

That list is your floor. From there, one rule keeps the couples match free:

> **Move a row up only if both of you would rather have it than every row it jumps over.**

Whatever programs turn out to be within reach, each of you then ends up somewhere you like at least as much as before.

> The only exceptions when couples matching might hurt you:
>
> - You have more than 300 combinations and you have to cut some out
> - You will have to pay more in fees to the NRMP
> - You end up breaking up with your partner (sorry, Pairwise can't help with that...)

## It's all in the details

OK, so couples matching can adapt your preferences to your partner, *and* you can create a safety net so it's not worse than matching as an individual. Why do I need Pairwise?

Creating your optimal list is hard. It's humanly impossible to make every comparison between your programs. Imagine sorting up to 300 items where every comparison requires you to envision your future together (or apart). It's exhausting and error-prone, and we are all susceptible to inconsistency in our preferences.

Pairwise isn't simply a model that sorts your combinations by a composite score of distance and rank.

The key insight behind Pairwise: not all comparisons need to be made by you. **The core engine of Pairwise prioritizes the most important this-or-that comparisons that affect your match outcome.** The rest can be inferred from your tiered rank list and how important proximity is to you (learned from your comparisons). The more you answer, the more accurate your rank list will be. But in most cases just a few dozen comparisons will get you more than 95% of the way there.

If you have some program preferences that you want to specify, Pairwise lets you set them.

If you and your partner disagree, Pairwise will flag it.

If you gave conflicting responses (A > B > C > A), Pairwise will flag that too. Either way, it helps the two of you talk through the comparisons that actually matter.

Pairwise also lets you simulate your match outcomes to make sure your list truly reflects what you want. For more details, see [How to Use Pairwise](${HOW_TO_USE}).

Back to my story. Arianna and I ended up matching at Penn and Johns Hopkins, which was one of those combinations that let us get amazing training but not be too far away from each other. It wouldn't have happened if we had matched individually. We're now married with a daughter, and our relationship - not our careers - is the most important thing in our lives.

So, if you want to give med school love a chance, let Pairwise help you.
`,
  },
  {
    slug: 'technical-guide-to-the-couples-match',
    title: 'A Technical Guide to the Couples Match',
    description: 'How the NRMP algorithm reads a couple’s list, why couples matching can cost nothing, and the mistakes that show up on Match Day.',
    date: '2026-11-26',
    body: `The NRMP gives a couple the highest row on their list where both partners can get in, so the best list is your true order of preference. Writing an error-free couples list that reflects both of your preferences, though, is easier said than done. This guide explains how the Match reads a couple's list, why a list built from your two individual lists can't cost either of you anything, why some changes to a list make no difference, and the mistakes that show up only on Match Day.

This post might be hard to follow, but it is written for readers who want a precise explanation. Pairwise is not affiliated with the NRMP; for the official rules, see [Couples in the Match](${NRMP_COUPLES}).

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

## How the Match works

### For one applicant

The NRMP uses the Roth–Peranson algorithm. Applicants apply down their lists, and programs hold on to the best applicants they have seen so far.

1. Each applicant applies to the first program on their rank list.
2. A program tentatively holds the applicants it ranks highest, up to its number of positions. Everyone else is turned down.
3. If a better-ranked applicant arrives later, the program bumps the weakest applicant it holds.
4. An applicant who is turned down or bumped applies to the next program on their list. Nobody ever moves back up their list.
5. When nobody is left to move, every tentative hold becomes the final match.

### For a couple

A couple matches together on one row of their list, or not at all. They are never split across rows.

A couple submits one list of up to 300 rows. Each row is an ordered pair (A₁, B₂) from P₁ × P₂. Either side can be No Match: NM₁ or NM₂ means that partner goes unmatched in this row. Leave (NM₁, NM₂) off your list: both of you going unmatched is what happens anyway when no row works.

- **A row works only if both partners are held at the same time.** No Match always works for that partner, because it needs no position.
- **If either partner is turned down,** the other partner's application is withdrawn too, and the couple tries the next row.
- **If one partner is bumped later,** the other partner gives up their spot as well. That spot can go to someone else. The couple then carries on from the next row.
- **A couple never moves back up their list,** just like a single applicant.

## The simple way to think about it

You match on the first row of your list where both of you are within reach.

On Match Day, Partner 1 can get into the programs in F₁ and Partner 2 into those in F₂. Read your list from the top. Your match is the first row (A₁, B₂) with A₁ ∈ F₁ and B₂ ∈ F₂ (∈ means "is in").

Nobody knows F₁ or F₂ in advance, not you and not any tool. So your list has to give the right answer whatever they turn out to be. The only list that does that is your true order of preference.

## How big the list gets

Every program on one partner's list can pair with every program on the other's, plus No Match on either side. If Partner 1 ranks n₁ programs and Partner 2 ranks n₂, the number of possible rows is:

<p class="formula">(n₁ + 1)(n₂ + 1) − 1</p>

The −1 drops (NM₁, NM₂), which is never a row. With 10 programs each that is 120 rows. With 16 each it is 288, just under the NRMP's limit of 300. With 17 each it is 323, and with 20 each it is 440, so most couples cannot list every combination and have to choose which ones to leave off. Uneven lists fit more easily: 25 programs and 10 programs make 285 rows.

Numbers are only half the problem. Each row is a whole future for two people: two programs, two cities, and the distance between them. Ranking 300 of those by hand means making tens of thousands of implicit comparisons, and it is easy for some of them to contradict each other.

## The baseline list: why couples matching can cost nothing

Start with what I'll call the **baseline list**, built from your two individual rank lists:

1. Every pair where you both match, in Partner 1's order: Partner 1's #1 program with each of Partner 2's programs in Partner 2's order, then Partner 1's #2 with each of Partner 2's, and so on.
2. Then (A₁, NM₂), (B₁, NM₂), … in Partner 1's order.
3. Then (NM₁, A₂), (NM₁, B₂), … in Partner 2's order.

**With the baseline list, each of you matches exactly where you would have matched alone**: Partner 1 at their best program in F₁, and Partner 2 at their best program in F₂. There are four cases.

- **Both of you can match somewhere.** Say A₁ is Partner 1's best program in F₁ and B₂ is Partner 2's best in F₂. Every both-match row above (A₁, B₂) either gives Partner 1 a program they like more than A₁, which is out of reach, or pairs A₁ with a program Partner 2 likes more than B₂, which is also out of reach. So (A₁, B₂) is the first row that works.
- **Only Partner 1 can match.** No both-match row works. The first row that does is (A₁, NM₂).
- **Only Partner 2 can match.** No row in parts 1 or 2 works, and the first that does is (NM₁, B₂).
- **Neither of you can match.** No row works, and you both go unmatched, as you would have alone.

The No Match rows sit at the bottom, as the NRMP recommends. Ordering the both-match rows in Partner 2's order instead gives the same result ([see the table under Equivalent lists](#two-orders)). The one requirement is room: the baseline list has n₁n₂ + n₁ + n₂ rows, which must fit in 300.

### Moving rows up

The baseline list is a floor. From there, one rule keeps the couples match free of cost:

> **Move a row up only if both of you would rather have it than every row it jumps over.** Then, whatever programs turn out to be reachable, each of you ends up somewhere you like at least as much as before.

Why: moving row X up changes your match only when X is reachable and one of the rows it jumped over would otherwise have been your match. You both prefer X to each of those rows, so you both prefer the new result. In every other case nothing changes.

What the rule buys you is preferences that depend on where your partner lands. Say Partner 1 likes A₁ more than B₁ on its own, but would rather be at B₁ if Partner 2 is at B₂ in the same city than at A₁ across the country from B₂. Partner 2, at B₂ either way, would rather be near Partner 1. Moving (B₁, B₂) above (A₁, B₂) makes you both better off whenever it matters. Applying separately, neither of you can say "B₁, but only if my partner gets B₂." A couples list is the only place you can say it.

## Equivalent lists

Two different lists can always put you in the same place. We call them **equivalent**: whatever F₁ and F₂ turn out to be, both lists give the same match. This is a big part of why couples lists are hard. Some changes to your list make no difference to your outcome, and a move you make may not have the effect you intended. The upside is that we only have to pay attention to the changes to your list that *would* make a difference to your outcome.

<span id="two-orders"></span>The simplest example is the box P₁ × P₂ written out in two different orders. In the table, each partner has two programs. List 1 goes down Partner 1's list and, for each of Partner 1's programs, down Partner 2's list. List 2 does the reverse. The rows come in a different order, yet both lists match each of you exactly where you would match as individuals.

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

### The box of two rows

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

## Common mistakes

None of these mistakes is unusual, and none of them shows up until results come out.

| Mistake | What happens on Match Day |
| --- | --- |
| **No rows where one partner goes unmatched** | If Partner 2 cannot get into any program paired with Partner 1's reachable programs, you both go unmatched, even though Partner 1 could have matched alone. |
| **No Match rows placed high** | Every later row that gives that partner the same program can never be reached. You have also chosen being apart over every pair below it. |
| **Cutting the list to fit 300 rows from the bottom** | The No Match rows usually sit at the bottom, so they are the first to go. They are your safety net. |
| **Ranking by odds instead of preference** | Moving a "safer" pair up never helps. If both pairs are reachable, you get the one you like less; if only one is, its position made no difference. |
| **Spending time on swaps that change nothing** | If (A₁, D₂) already sits above (A₁, B₂) and (C₁, D₂), the order of those two can never matter. |
| **A drag that moves more than you meant** | Moving one row up ten places changes its order against all ten rows it passes, not just the one you were thinking about. |
| **Preferences that go in a circle** | You agree on X over Y one evening, Y over Z the next, and Z over X a week later. No list can honour all three, so one is broken by whoever edited last. |
| **Counting on both of you at the same program** | Matching at the same program requires two open positions there at once. Each of you being able to get in alone does not guarantee it. |
| **Wrong or repeated NRMP codes in R3** | A mistyped code ranks a different program or track. A repeated row can never be reached and only takes up space. |

## Where the simple picture is not exact

The reachable-programs picture is very close to how the Match behaves, with three exceptions.

- **Both partners at the same program.** Sometimes A₁ and A₂ are the same program, for example when you both apply to one internal medicine residency. The row (A₁, A₂) then needs two open positions there at once, and A₁ ∈ F₁ and A₂ ∈ F₂ separately don't guarantee that. So it can turn out differently from two separate applications, and a row like this can't be counted on to make another comparison irrelevant.
- **Knock-on effects.** When a couple gives up one partner's spot, someone else can get in, which can shift other results. In theory, what is reachable can depend slightly on the lists themselves. Across the whole Match the effect is small, and the NRMP's advice stays the same: rank your true preferences.
- **Not enough room.** If the baseline list runs past 300 rows, some pairs have to go. Drop (A₁, B₂), and if those turn out to be your two best reachable programs, the list falls through to a lower row: one of you may end up somewhere worse, or unmatched where you would have matched alone. If you must cut, cut pairs near the bottom of both your lists, and never the No Match rows.

## How Pairwise uses all this

It is unreasonable to ask anyone to picture nearly 300 outcomes, let alone put them in order. Using the logic above, Pairwise builds a list from a much smaller set of key comparisons and focuses on getting those right.

- **You rank your own programs, not 300 pairs.** Pairwise builds every pair from your two lists and works out how far apart each one is.
- **It skips comparisons that don't matter.** If a pair from the box already sits above two rows, it won't ask you to choose between them.
- **It follows rules no score can break.** A pair at least as good for both of you, and no farther apart, always ranks higher. Rows where you both match come before rows where one of you doesn't.
- **It catches preferences that go in a circle** and shows you which answers conflict so you can decide.
- **It warns about rows that can never be reached**, such as those below a No Match row moved up from the bottom.
- **It treats pairs at the same program with care**, never assuming you both get in just because each of you could alone.
- **It checks the list before you submit:** the 300-row limit, No Match rows at the bottom, and NRMP codes.

When you're ready, give Pairwise a try, and check out the guide at [How to Use Pairwise](${HOW_TO_USE}).
`,
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export { HOW_TO_USE };
