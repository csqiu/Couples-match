export interface Step {
  n: number;
  slug: string;
  title: string;
  short: string;
  /** Built in a later phase; shown in the rail but not yet linked. */
  comingSoon?: boolean;
}

export const STEPS: Step[] = [
  { n: 1, slug: 'setup', title: 'Welcome and setup', short: 'Setup' },
  { n: 2, slug: 'programs', title: 'My programs', short: 'Programs' },
  { n: 3, slug: 'rank', title: 'Rank and tier', short: 'Rank' },
  { n: 4, slug: 'compare', title: 'This or that', short: 'Compare' },
  { n: 5, slug: 'conflicts', title: 'Resolve conflicts', short: 'Conflicts' },
  { n: 6, slug: 'list', title: 'Final list', short: 'Final list', comingSoon: true },
];
