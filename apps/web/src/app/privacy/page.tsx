import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/brand';

export const metadata: Metadata = { title: 'Privacy' };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed">
      <Link href="/" className="text-lg font-semibold">{BRAND.name}</Link>
      <h1 className="mt-8 text-2xl font-semibold">Privacy</h1>
      <div className="mt-6 flex flex-col gap-4 text-muted">
        <p>Your rank lists are sensitive. Here is exactly what we do with them.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-text">Only the two of you can see your couple’s data.</strong> The database enforces this on every request, not just the app.</li>
          <li><strong className="text-text">No third-party analytics</strong> ever see your programs, ranks or answers.</li>
          <li><strong className="text-text">No passwords.</strong> You sign in with an emailed link or Google.</li>
          <li><strong className="text-text">Leaving a couple</strong> makes it read-only; it is deleted after 30 days.</li>
          <li><strong className="text-text">Deleting your account</strong> immediately removes your profile and your rank list.</li>
          <li>We never contact programs and never submit anything to the NRMP. You enter and certify your list in R3 yourselves.</li>
        </ul>
        <p>Questions: {BRAND.supportEmail}</p>
      </div>
    </main>
  );
}
