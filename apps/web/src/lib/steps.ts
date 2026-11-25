export interface Step {
  n: number;
  slug: string;
  title: string;
  short: string;
}

/** Done once, before the dashboard: who you are, who your partner is, and your programs. */
export const ONBOARDING_STEPS: Step[] = [
  { n: 1, slug: 'setup', title: 'Welcome and setup', short: 'Setup' },
  { n: 2, slug: 'programs', title: 'My programs', short: 'Programs' },
];

/** The steps inside a list (each fresh start from the dashboard). */
export const LIST_STEPS: Step[] = [
  { n: 1, slug: 'rank', title: 'Rank and tier', short: 'Rank' },
  { n: 2, slug: 'compare', title: 'This or that', short: 'Compare' },
  { n: 3, slug: 'conflicts', title: 'Resolve conflicts', short: 'Conflicts' },
  { n: 4, slug: 'list', title: 'Final list', short: 'Final list' },
];

/** Pages that work inside the open list (they show the list bar and its steps). */
export const LIST_PAGES = ['rank', 'compare', 'conflicts', 'list', 'explore', 'map', 'versions'];
