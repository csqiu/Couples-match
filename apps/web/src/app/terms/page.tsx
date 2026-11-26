import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { TERMS_OF_USE } from '@/content/legal';

export const metadata: Metadata = { title: 'Terms of Use', description: 'The terms for using Pairwise.' };

export default function Terms() {
  return <LegalPage title="Pairwise Terms of Use" markdown={TERMS_OF_USE} />;
}
