import 'server-only';
import { notFound } from 'next/navigation';
import { requireContext } from './context';

/** Signed in as an admin; everyone else gets a plain 404 (the admin area isn't advertised). */
export async function requireAdmin() {
  const ctx = await requireContext();
  if (!ctx.profile.is_admin) notFound();
  return ctx;
}
