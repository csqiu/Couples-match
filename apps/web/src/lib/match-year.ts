/**
 * The Main Residency Match happens in March. From April on, applicants are
 * preparing for next year's Match.
 */
export function currentMatchYear(today = new Date()): number {
  return today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
}

export function matchYearOptions(today = new Date()): number[] {
  const y = currentMatchYear(today);
  return [y, y + 1];
}
