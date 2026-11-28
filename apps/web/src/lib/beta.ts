/** New accounts are capped during the beta (migration 16); Supabase reports the refusal this way. */
export const BETA_FULL_MESSAGE =
  'Pairwise is in a closed beta and all places are taken. If you already have an account, use the email you signed up with.';

export function isBetaFull(message: string | null | undefined): boolean {
  return !!message && /database error saving new user|beta_full/i.test(message);
}
