# Pairwise visual design spec

**Direction:** Technical type · Sage & Plum color · Frosted glass surfaces
**Status:** approved for implementation (Nov 2026). Replaces the teal "calm neutral" look in `apps/web/src/app/globals.css`.

This spec is self-contained: everything needed to restyle the web app is here. It changes **look only**. Do not change copy, routes, behavior, data, or the accessibility rules already in the code (color is never the only signal; 44px touch targets; visible focus; reduced motion).

---

## 1. Principles

1. **Plum and sage are the two partners.** Sage = partner 1, plum = partner 2. These hues are used for things that *belong to a person* (avatars, their column, their pins) and for tiers. They are **not** used for buttons or other controls.
2. **Controls are ink.** Primary buttons, switches, the current step, selected options and focus rings use a neutral deep green-ink (`--action`). No control should read as "one partner's button."
3. **Distance bands are semantic.** Together / commutable / drivable / apart keep their own green → olive → amber → brick scale, always paired with a label and icon (already true in `components/proximity.tsx`).
4. **Glass is for containers, not for everything.** Cards, the step rail, the header pill and floating panels are frosted. Rows inside a card are a lighter translucent white without their own blur. Text never sits directly on a colored blob.
5. **Mono for numbers.** Ranks, miles, NRMP codes, counts, dates in lists and fees use the mono face with tabular numbers.

---

## 2. Typography

| Role | Family | Weights | Use |
|---|---|---|---|
| Display (`--font-display`) | **Space Grotesk** | 500, 600, 700 | Page titles, card titles, the logo, big numbers in hero/landing, question text on This or that |
| Text (`--font-sans`) | **IBM Plex Sans** | 400, 500, 600 | Everything else: body, labels, buttons, inputs |
| Data (`--font-mono`) | **IBM Plex Mono** | 400, 500, 600 | Rank numbers, miles, NRMP codes, counts, fees, version dates, eyebrow labels |

Load all three with `next/font/google` in `app/layout.tsx` (`Space_Grotesk`, `IBM_Plex_Sans`, `IBM_Plex_Mono`, `display: 'swap'`, `subsets: ['latin']`), expose them as CSS variables on `<html>`, and map them in `@theme inline` (section 4).

**Scale** (desktop / phone):

| Token | Size / line-height | Weight | Tracking | Family |
|---|---|---|---|---|
| Landing hero | 60px / 1.02 (phone 38px) | 600 | -0.035em | display |
| Page title (`h1`) | 34px / 1.08 (phone 28px) | 600 | -0.025em | display |
| Section title | 30px / 1.1 | 600 | -0.02em | display |
| Card title (`h2`) | 19px / 1.2 | 600 | -0.01em | display |
| Small title (`h3`) | 15.5px / 1.3 | 600 | 0 | display |
| Body | 15px / 1.55 | 400 | 0 | sans |
| Small / hints | 13–13.5px / 1.5 | 400 | 0 | sans |
| Eyebrow / kicker | 11.5px / 1, uppercase | 500 | 0.1em | mono |
| Table header | 11px, uppercase | 500 | 0.08em | mono |
| Rank number in lists | 15px | 600 | 0 | mono, `tabular-nums` |

Headings get `text-wrap: balance`. Keep running text ≤ ~65ch.

---

## 3. Color tokens

All colors are CSS custom properties. Light values on `:root`, dark values on `.dark` (the app toggles a `.dark` class on `<html>`; keep that mechanism and `themeScript`).

### 3.1 Light

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#f4f5f0` | Page ground (sage-tinted off-white) |
| `--surface` | `#fdfdfa` | Solid surface (menus, fallbacks, avatar ring) |
| `--surface-2` | `#eef0e8` | Subtle fill (hover, neutral badge, tracks) |
| `--border` | `#dcdfd2` | Hairlines, input borders |
| `--text` | `#232620` | Primary text |
| `--muted` | `#585d51` | Secondary text (passes AA on worst-case glass) |
| `--action` | `#2b3529` | **Primary buttons, switches on, current step, selected options** |
| `--action-hover` | `#3c4a39` | Hover for the above |
| `--action-fg` | `#f7f8f2` | Text/icons on `--action` |
| `--action-soft` | `#e9ece3` | Hover fill for outline buttons |
| `--accent` | `#3d6838` | Links, positive status text, "Linked" badge (sage-deep) |
| `--accent-soft` | `#e6eee3` | Success banners, together-row tint |
| `--accent-fg` | `#ffffff` | Text on `--accent` fills |
| `--focus` | `#2b3529` | Focus ring (2px, 2px offset) |
| `--partner-1` | `#5f7d5a` | Sage. Avatars, partner-1 column marks, map pins |
| `--partner-1-soft` | `#e6eee3` | |
| `--partner-2` | `#6b4a7a` | Plum. Avatars, partner-2 marks, map pins |
| `--partner-2-soft` | `#efe7f2` | |
| `--partner-fg` | `#ffffff` | Initials on partner avatars |
| `--plum-deep` | `#573a65` | Rank numbers in lists (see open question 1) |
| `--tier-a` | `#5f7d5a` | Tier A: solid sage badge, white text |
| `--tier-b` | `#573a65` | Tier B: plum text on `--partner-2-soft`, 1px plum border at 30% |
| `--tier-c` | `#585d51` | Tier C: muted text, 1.5px `--border` outline, no fill |
| `--band-together` | `#3d6838` | |
| `--band-commutable` | `#4b6219` | (darkened from the mockup's `#56701f` for AA on plum-tinted glass) |
| `--band-drivable` | `#865611` | |
| `--band-apart` | `#8f2f2f` | |
| `--warn` | `#865611` | |
| `--warn-soft` | `#f6ecd9` | |
| `--danger` | `#a33232` | |
| `--danger-soft` | `#fdf5f4` | Delete-account card tint |
| `--glass` | `rgba(253,253,250,.56)` | Card / rail fill |
| `--glass-strong` | `rgba(253,253,250,.80)` | Panels with dense text, inputs, secondary buttons |
| `--glass-row` | `rgba(255,255,255,.50)` | Rows/items inside a glass card (no blur) |
| `--glass-border` | `rgba(255,255,255,.78)` | 1px border on glass |
| `--blob-1` | `#8fae88` | Backdrop blob (sage) |
| `--blob-2` | `#a983b8` | Backdrop blob (plum) |
| `--blob-3` | `#c9d6b8` | Backdrop blob (mist) |
| `--shadow` | `0 14px 36px -18px rgba(35,38,32,.32), 0 2px 6px -2px rgba(35,38,32,.08)` | Glass elevation |

### 3.2 Dark

| Token | Value |
|---|---|
| `--bg` | `#141612` |
| `--surface` | `#1d201b` |
| `--surface-2` | `#262a23` |
| `--border` | `#2f342b` |
| `--text` | `#eceee6` |
| `--muted` | `#a2a797` |
| `--action` | `#dfe6d4` |
| `--action-hover` | `#ccd5bf` |
| `--action-fg` | `#1a2018` |
| `--action-soft` | `#2a3027` |
| `--accent` | `#9cc095` |
| `--accent-soft` | `#1f2a1d` |
| `--accent-fg` | `#10170e` |
| `--focus` | `#dfe6d4` |
| `--partner-1` | `#7fa278` |
| `--partner-1-soft` | `#1f2a1d` |
| `--partner-2` | `#9a74ab` |
| `--partner-2-soft` | `#2a2230` |
| `--partner-fg` | `#141612` (dark initials; white fails contrast on the lighter dark-mode partner colors) |
| `--plum-deep` | `#c8a4d8` |
| `--tier-a` | `#7fa278` (badge text `#141612`) |
| `--tier-b` | `#c8a4d8` |
| `--tier-c` | `#a2a797` |
| `--band-together` | `#9cc095` |
| `--band-commutable` | `#c4d27a` |
| `--band-drivable` | `#e4b46a` |
| `--band-apart` | `#ee8a80` |
| `--warn` | `#e4b46a` |
| `--warn-soft` | `#33280f` |
| `--danger` | `#f08a80` |
| `--danger-soft` | `#2a1716` |
| `--glass` | `rgba(29,32,27,.60)` |
| `--glass-strong` | `rgba(29,32,27,.82)` |
| `--glass-row` | `rgba(255,255,255,.04)` |
| `--glass-border` | `rgba(255,255,255,.08)` |
| `--blob-1` | `#3f5a3a` |
| `--blob-2` | `#4a3556` |
| `--blob-3` | `#2c3a28` |
| `--shadow` | `0 14px 36px -18px rgba(0,0,0,.6), 0 2px 6px -2px rgba(0,0,0,.3)` |

Update `viewport.themeColor` in `app/layout.tsx` to `#f4f5f0` (light) and `#141612` (dark).

### 3.3 Contrast (checked)

Measured against the worst case: `--glass` over a blob at full strength.
- Light: text 11.7:1, muted 5.2:1, accent 5.0:1, bands 4.8–6.1:1 (commutable 5.2:1 after the darkening), danger 5.2:1. `--action-fg` on `--action` 12:1. White on partner-1 4.6:1, on partner-2 7.3:1.
- Dark: text 12.6:1, muted 6.0:1, bands 6.0–9.0:1. `--action-fg` on `--action` 13:1. `--partner-fg` on partners 4.7–6.4:1.

If you add a new text/background pair, check it hits 4.5:1 (3:1 for 24px+ text).

---

## 4. `globals.css` shape

Keep the existing structure (`@import "tailwindcss"`, `@custom-variant dark`, `:root`, `.dark`, `@theme inline`). Replace the token values with section 3, add the new tokens, and extend `@theme inline` so Tailwind utilities exist for them:

```css
@theme inline {
  /* existing mappings stay, with new values */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-fg: var(--accent-fg);
  --color-accent-soft: var(--accent-soft);
  /* …band-*, warn*, danger, tier-*, partner-* as today… */

  /* new */
  --color-action: var(--action);
  --color-action-hover: var(--action-hover);
  --color-action-fg: var(--action-fg);
  --color-action-soft: var(--action-soft);
  --color-partner-fg: var(--partner-fg);
  --color-plum-deep: var(--plum-deep);
  --color-danger-soft: var(--danger-soft);
  --color-glass: var(--glass);
  --color-glass-strong: var(--glass-strong);
  --color-glass-row: var(--glass-row);
  --color-glass-border: var(--glass-border);

  --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;

  --radius-card: 24px;
  --radius-panel: 20px;
  --radius-row: 16px;
  --radius-input: 14px;
  --shadow-glass: var(--shadow);
}
```

Add these utility classes in `globals.css` (plain CSS, so components stay short):

```css
.glass {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  backdrop-filter: blur(22px) saturate(1.4);
  -webkit-backdrop-filter: blur(22px) saturate(1.4);
}
.glass-strong { background: var(--glass-strong); }
.glass-row {
  background: var(--glass-row);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-row);
}
/* No blur support, or the person asked for less transparency: go solid. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .glass-strong { background: var(--surface); }
}
@media (prefers-reduced-transparency: reduce) {
  .glass, .glass-strong { background: var(--surface); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .backdrop { display: none; }
}
```

---

## 5. The backdrop

A single fixed, decorative layer behind every page, added once in `app/layout.tsx` as the first child of `<body>`:

```tsx
<div className="backdrop" aria-hidden>
  <i className="b1" /><i className="b2" /><i className="b3" />
</div>
```

```css
.backdrop { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.backdrop i { position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; }
.backdrop .b1 { width: 560px; height: 560px; left: -160px; top: -140px; background: var(--blob-1); }
.backdrop .b2 { width: 520px; height: 520px; right: -150px; top: 40vh; background: var(--blob-2); }
.backdrop .b3 { width: 480px; height: 480px; left: 35%; bottom: -200px; background: var(--blob-3); opacity: .7; }
@media (max-width: 640px) { .backdrop i { width: 320px !important; height: 320px !important; filter: blur(70px); } }
```

- Blobs do **not** animate.
- `body` keeps `background: var(--bg)`, so the page is never transparent.
- The print routes (`/print/*`) must hide the backdrop and render glass as solid white (`@media print { .backdrop { display: none } .glass { background: #fff; box-shadow: none; backdrop-filter: none } }`).

---

## 6. Components

Update the shared primitives first. Most screens then follow automatically.

### Button (`components/ui/button.tsx`)
All buttons are pills (`rounded-full`), `min-h-11` (44px), `px-5`, `text-[14.5px] font-semibold`. `sm`: `min-h-9 px-3.5 text-[13.5px]` (wrap it so the hit area stays 44px, as `Switch` does today). `icon`: 44×44 with `rounded-[14px]`.

| Variant | Style |
|---|---|
| `primary` | `bg-action text-action-fg hover:bg-action-hover`, shadow `inset 0 1px 0 rgba(255,255,255,.18), 0 10px 22px -12px rgba(43,53,41,.7)` (no shadow in dark) |
| `secondary` | `glass-strong` fill, `border border-glass-border text-text`, small shadow `0 6px 16px -10px rgba(35,38,32,.4)`, `hover:bg-surface` |
| `outline` (new) | `bg-glass-strong text-action border-2 border-action hover:bg-action-soft`. Use for **"Strong preference for this pair"** on Compare (replaces the current `border-accent text-accent` override). |
| `ghost` | `text-text hover:bg-glass` |
| `danger` | solid `bg-danger text-white` for the final destructive action (Delete my account); secondary-style with `text-danger` for the first step (Leave the couple) |

### Card (`components/ui/card.tsx`)
`glass p-5 sm:p-6` (24px radius). Add an optional `tone` prop:
- `strong`: adds `glass-strong`. Use for dense panels: This or that options, conflict cards, the sign-in/invite card, "What you're trading".
- `danger`: `border-danger/35 bg-danger-soft/60`. Use for Delete your account.

`CardHeader` title uses `font-display text-[19px] font-semibold tracking-[-0.01em]`.

### Rows inside cards
Program items, final-list rows, activity events and version entries use `.glass-row` with `px-3.5 py-3` and a 16px radius, with no blur. The hover/selected row gets `bg-surface` plus a 2px ring in `--action` at 25%.

### Badge (`components/ui/badge.tsx`)
Pill, `px-2.5 py-1.5 text-xs font-semibold`.
- `neutral`: `bg-surface-2 text-muted`
- `accent`: `bg-accent-soft text-accent` ("Linked", "Added")
- `warn`: `bg-warn-soft text-warn`
- Tier badges become **24×24 rounded-[8px] squares** with a mono letter: A = solid `--tier-a` with white (dark: `#141612`) letter; B = `--partner-2-soft` fill, `--tier-b` letter, 1px plum border at 30%; C = transparent, `--tier-c` letter, 1.5px `--border` inset outline.

### Band chips (`BandBadge` in `components/proximity.tsx`)
Keep the icon and label. Style: pill, `text-xs font-semibold px-2.5 py-1.5`, text in the band color, fill = band color at 12%. **No Match**: transparent fill, 1.5px inset `--warn` outline, `--warn` text. Distances use mono (`· 34 mi`).

Final-list row tint by band (replaces `BAND_ROW`): together → `bg-accent-soft/70`; commutable → `bg-accent-soft/35`; drivable and apart → `.glass-row`; apart text in `--muted`; no_match → `border-[1.5px] border-dashed border-warn bg-glass/35`.

### Switch (`components/ui/switch.tsx`)
Track 44×26 (`h-[26px] w-11`), on = `bg-action`, off = `bg-border`; thumb 20px white with a small shadow.

### Inputs (`components/ui/field.tsx`)
`min-h-[46px] rounded-[14px] border border-border bg-glass-strong px-3.5 text-[15px]`; focus: `outline-2 outline-action outline-offset-1`. Selects keep the native control with a custom chevron. Labels `text-[13px] font-semibold`; hints `text-[12.5px] text-muted`.

Radio-card choices (Setup: privacy and answer mode): `rounded-2xl border border-border bg-glass-row p-3.5 pl-11` with an 18px radio dot at left. Selected: `border-action bg-action-soft/80`, dot `inset 0 0 0 5px var(--action)`.

### Step rail (`components/progress-rail.tsx`)
A single glass pill: `glass rounded-full p-1.5 flex gap-1`, horizontally scrollable on narrow screens. Each step: `rounded-full min-h-10 pl-1.5 pr-3.5 gap-2 text-sm`. Number circle 28px, mono 12px:
- current: step pill `bg-surface font-semibold text-text` with a small shadow; circle `bg-action text-action-fg`
- done: circle `bg-accent-soft text-accent` with the check icon
- upcoming: circle `bg-text/6 text-muted`
- disabled / coming soon: 50% opacity (as today)

### Header (`app/app/layout.tsx`, landing, login, invite)
- **Logo:** the wordmark "Pairwise" in display 20px/700, tracking -0.02em, preceded by the **two-circle mark**: two 20px circles overlapping (30×20 box), left `--partner-1`, right `--partner-2`, `mix-blend-mode: multiply` (`screen` in dark). Pure CSS; no image.
- **Presence (`components/live.tsx`):** glass pill, 36px tall: partner avatar (24px), "Jordan is here", and a 8px `--band-together` dot with a 3px 18% halo.
- **Icon buttons** (activity, theme, account): 44×44, `rounded-[14px]`, `text-muted`, hover `bg-glass border-glass-border text-text`. The current page's icon gets `bg-glass-strong text-text` and `aria-current="page"`.

### Avatars
Circles with initials: 28px default, 40px large, 22px inline. `bg-partner-1` / `bg-partner-2`, `text-partner-fg`, 12px/700. Overlapping pairs: second avatar `-ml-2` with a 2px `--surface` ring.

### Progress (List confidence on Compare)
10px track `bg-text/8`, fill = `linear-gradient(90deg, var(--partner-1), var(--partner-2))`. This is the one place the two partner colors blend, on purpose. The percentage is in mono.

### Banners (`role="status"` notices)
`rounded-2xl px-4 py-3 text-sm` with `border border-glass-border`. Success = `bg-accent-soft/80 text-accent`; warning = `bg-warn-soft/85 text-warn`; error = `text-danger` on `bg-danger-soft`.

### Footer (`components/site-footer.tsx`)
Unchanged content. `border-t border-border text-[12.5px] text-muted`, no glass.

---

## 7. Screen notes

The layout of each screen stays as it is, except for the changes noted below. Max content width stays `max-w-5xl`, but give the final list and the map `max-w-6xl` so the side panel fits.

| Screen | Notes |
|---|---|
| **Landing** (`app/page.tsx`) | Hero split into two columns on desktop: copy left (eyebrow "For the NRMP Couples Match", 60px headline, lede at 18px, `primary` "Get started" + `secondary` "See how it works"); right, a decorative stack of two glass cards: a 3-row final-list preview and a small "This or that" card, overlapping. The three value cards become glass cards. The "How it works" steps become six glass panels in a 3-column grid with mono `01`–`06` numbers (it's a real sequence). |
| **Sign in / Invite** | Centered `Card tone="strong"`, max-w-md, 30px padding, 28px title. The "Check your email" state centers an envelope icon in `--partner-2`. |
| **Setup** | "About you" and "Your couple" side by side on desktop. "Your couple" shows both avatars (40px, overlapping), both names, both specialties. Settings use radio cards; the band thresholds show their band chip as the label and a mono input. |
| **Programs** | Two columns: Add programs (search with leading icon, filter selects at 38px) and Your list (mini-map on top, then rows). Programs added by hand get a dashed row border. |
| **Rank** | Three tier columns side by side on desktop (stack on phone). Tier A column tinted `bg-accent-soft/60`, Tier B `bg-partner-2-soft/55`, Tier C plain glass. Rows: drag grip, mono rank, name, city. While dragging, the row lifts (`rotate(-1.2deg)`, larger shadow, `--action` border) and the drop slot is an 8px pill in `--action` at 35%. The Tier A rule toggle sits in a small glass panel next to "Next". |
| **Compare** | The two options are `Card tone="strong"` with a round 52px "or" chip between them. In each option, both partners' programs are stacked: avatar, mono eyebrow "Maya · #1 · Tier A", program in display 18px, city. A dashed line between them carries the distance and band chip. Buttons: `primary` "Choose this pair", `outline` "Strong preference for this pair". |
| **Conflicts** | The cycle card shows the statements as large tappable rows with mono letters A/B/C and arrows between them, ending "↺ back to A". Tier-A priority and "Still true?" cards sit beside it. |
| **Final list** | Main column: glass table of rows (`44px · grip · Partner 1 · Partner 2 · distance`), mono rank numbers, tier squares before each program, band chip at right. Selected row: `--action` ring. No Match rows locked at the end with a lock icon and a dashed amber border. Side column (320px): "What you're trading", "Before you certify in R3" checklist (checked = `--partner-1` filled box), fee estimate in mono. A row of band count chips above the table. |
| **Map** | Keep the real map. Lines by band: together solid 4px, commutable dashed, drivable long-dash 2.5px, apart dotted, each in its band color. Band filter toggles are glass pills showing a line sample; off = 50% opacity with `aria-pressed="false"`. |
| **Versions** | Version list left (selected one gets the `--action` ring), compare panel right with summary badges (moved up = accent, moved down = danger-soft, added = partner-2-soft, removed = warn) and diff rows with mono "▲ from 5". |
| **Activity** | One `Card tone="strong"` (max-w-3xl) with mono day headings and rows of avatar · sentence · mono time. |
| **Account** | Two cards side by side (You / Your couple), then Your data, then the danger card. Definition lists: label column `--muted`, value 500 weight. |

---

## 7a. Pair display: four sizes

Every place the app shows a pair uses one of these (`components/pair.tsx`, data from `lib/pair-view.ts`).
Same rules in all four: partner 1 sage, partner 2 plum, partner 1 always first or on top; short name
first (`shortProgramName`), the full name one size up; distance is always the band chip; numbers mono.
Partner colour on a pair means only "whose program"; tiers are shown as words ("Tier A") in the eyebrow,
never as coloured squares in a pair.

| Size | Component | Used in | Shows |
|---|---|---|---|
| Large | `PairLarge` | This or that, Conflicts (Still true?, You answered differently), Explore's slots | Optional mini-map; per partner: avatar, eyebrow "Name · #rank · Tier X", short name (display 18px), full name, city; dashed connector with the band chip; optional tag ("Ari picked this") and action |
| Medium | `PairMedium` in `PairDetails` | Opens from a final-list row on hover (mouse), focus or tap | Rank of N, band chip, per partner a coloured bar with eyebrow, short and full name, city, NRMP code; "Why here" line |
| Small | `PairNames`, `PairTile` | Final-list rows, Not on your list, Explore picker, conflict statements | Two short names in partner text colours (columns on desktop, stacked on phones); tile adds rank and band chip |
| Inline | `ProgramChip`, `PairChip` | Sentences: What you're trading, flagged questions, Explore's explanations | A program as a chip on its partner's soft fill; a pair as two joined chips |

Explanations built by the engine use short names (`shortNamed` in `lib/pair-view.ts`). Print and CSV keep
full names and NRMP codes, since that is what goes into R3.

## 7b. Final list: relationship brackets

Opening a row's details by click or tap (not hover), or dragging a row, draws up to two brackets in the list's left margin. They join the row to the nearest row that must stay above it and the nearest that must stay below it (`lib/list-ties.ts`, `app/app/list/brackets.tsx`).

- **Which tie:** per side, a tie the row has crossed first, else the nearest one the couple set (answer, drag, conflict choice, Tier A rule), else the nearest automatic "better for both" rule. The No Match rule is left out.
- **Style:** solid `--action` for ties the couple set; dashed `--muted` for the automatic rule; solid `--warn` once a dragged row crosses one. Lines are 1.5px on phones and 2px from `sm` up.
- **Labels:** a pill at the middle of a bracket taller than about one row ("Your answer", "Tier A rule (Sam)", "Rule (auto)", "Crossing · …"). A far row scrolled out of sight becomes a pill at the window edge ("↑ #3 · 139 rows up · Your answer") that scrolls to it.
- **In words:** the details card lists "What holds it here" (rank, pair, source, one-line reason). While dragging, crossing a tie is announced politely.

## 8. Motion

Keep motion minimal: 150ms color/opacity/transform transitions on hover and press, and the existing drag animation. No animated blobs or page-load sequences. The existing `prefers-reduced-motion` block in `globals.css` stays.

---

## 9. Implementation order

1. Fonts in `layout.tsx`, tokens + `@theme` + `.glass` utilities + backdrop in `globals.css`/`layout.tsx`.
2. Primitives: `button.tsx`, `card.tsx`, `badge.tsx`, `switch.tsx`, `field.tsx`, `proximity.tsx`, `progress-rail.tsx`, `live.tsx`, `theme-toggle.tsx`, site header/logo.
3. Audit every `bg-accent`, `border-accent`, `text-accent-fg` use (about 15 places, `grep -rn "bg-accent\b\|border-accent\|text-accent-fg" apps/web/src`). Anything that is a **control** (button, switch, progress fill, selected state) moves to `action`. Anything that is **status or "together"** stays on `accent`.
4. Screens in the order of section 7. Compare's strong-preference button changes to `variant="outline"`.
5. Print pages: solid white, no backdrop.
6. Run `pnpm typecheck` and `pnpm test`, then check each screen in light and dark at 390px and 1280px. In particular: muted text on glass, band chips on the plum side of the page, and focus rings on glass.

### Acceptance checklist
- [ ] No plum or sage on any button, switch, focus ring, or selected state.
- [ ] Space Grotesk / IBM Plex Sans / IBM Plex Mono load with no layout shift; numbers in lists are mono and tabular.
- [ ] Every glass surface falls back to solid with `prefers-reduced-transparency` and without `backdrop-filter`.
- [ ] Text contrast ≥ 4.5:1 in both themes.
- [ ] Band meaning is still conveyed by icon + label, not color alone.
- [ ] Copy and behavior unchanged; tests pass.

---

## 10. Open questions (defaults chosen; easy to flip)

1. **Rank numbers** use `--plum-deep` (as in the approved mockups). Alternative: `--text`, so plum means only "partner 2" and "Tier B".
2. **Links** use `--accent` (sage-deep). The mockups used plum-deep for links; sage was chosen to keep plum off interactive elements.
3. **Theme picker warm-up** (partners pick a style and palette together during setup) is parked. Build only this one theme now; keep all colors in tokens so more themes can be added later.
