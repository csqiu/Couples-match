import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin';
import { ImportView } from './import-view';

export const metadata: Metadata = { title: 'Import programs' };

export default async function ImportPage() {
  await requireAdmin();
  return <ImportView />;
}
