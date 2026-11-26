import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
import { PRIVACY_POLICY } from '@/content/legal';

export const metadata: Metadata = { title: 'Privacy Policy', description: 'What Pairwise collects, why, who can see it, and your choices.' };

export default function Privacy() {
  return <LegalPage title="Pairwise Privacy Policy" markdown={PRIVACY_POLICY} />;
}
