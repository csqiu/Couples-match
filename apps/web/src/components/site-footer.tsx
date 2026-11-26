import { NRMP_RULES } from '@pairwise/engine';
import Link from 'next/link';
import { BRAND } from '@/brand';
import { CoffeeButton } from '@/components/coffee-button';

/** The persistent disclaimer required by the spec, plus rules provenance. */
export function SiteFooter() {
  const couples = NRMP_RULES.sources.find((s) => s.label.includes('Couples'));
  return (
    <footer className="border-t border-border px-4 py-6 text-xs text-muted sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {BRAND.name} is a planning tool and is not affiliated with the NRMP. You must enter and certify your list in R3
          yourselves.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <span>
            Rules for the {NRMP_RULES.rulesYear} Match{' '}
            {NRMP_RULES.lastVerified ? `last verified ${NRMP_RULES.lastVerified}` : '(not yet verified against nrmp.org)'}
          </span>
          {couples ? (
            <a className="underline underline-offset-2" href={couples.url} target="_blank" rel="noreferrer">
              NRMP couples rules
            </a>
          ) : null}
          <Link className="underline underline-offset-2" href="/privacy">
            Privacy
          </Link>
        </p>
        <CoffeeButton className="shrink-0 self-start sm:self-auto" />
      </div>
    </footer>
  );
}
