import { NO_MATCH } from '@pairwise/engine';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Laptop } from 'lucide-react';
import { LocalTime } from '@/components/local-time';
import { buttonVariants } from '@/components/ui/button';
import { requireCouple } from '@/lib/context';
import { checklistFor, feesFor } from '@/lib/final-list';
import { serverFinalList } from '@/lib/server-list';
import { createClient } from '@/lib/supabase/server';
import { versionLabel } from '@/lib/lists';
import { versionAsListRows, type VersionRow } from '@/lib/versions';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Printable list' };

/**
 * The list as an R3 entry worksheet: the checklist, then one table per partner (each
 * partner enters their own list in R3) with an "Entered" box per row, then both side by
 * side. Each table repeats a header naming the list and version on every printed page.
 * Printing always uses the light colours (globals.css), whatever the theme.
 */
export default async function PrintList({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { version } = await searchParams;
  const ctx = await requireCouple();
  const current = await serverFinalList(ctx);
  const names = current.bundle.names;

  let rows: VersionRow[];
  let title = ctx.list ? `List ${ctx.list.number} · as it is now` : 'Current list';
  let savedAt: string | null = null;
  let hasCycles = false;
  if (version) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('list_versions')
      .select('name, pairs, created_at, minor, list:rank_lists!list_versions_list_id_fkey(number)')
      .eq('id', version)
      .eq('couple_id', ctx.couple.id)
      .single();
    rows = (data?.pairs ?? []) as unknown as VersionRow[];
    const listNumber = (data?.list as unknown as { number: number } | null)?.number;
    title = data ? `${listNumber ? `Version ${versionLabel(listNumber, data.minor)} · ` : ''}${data.name}` : 'Version not found';
    savedAt = data?.created_at ?? null;
  } else {
    rows = current.snapshot.pairs;
    hasCycles = current.list.hasCycles;
  }

  // The checklist and fees for exactly what's printed, current list or saved version alike.
  const asRows = versionAsListRows(rows);
  const checklist = checklistFor(asRows, asRows.length, names, hasCycles).filter((c) => !version || c.label !== 'No unresolved conflicts');
  const fees = feesFor(asRows, asRows.length);
  const missing = ([0, 1] as const).map((k) => rows.filter((r) => (k === 0 ? r.a : r.b).id !== NO_MATCH && !(k === 0 ? r.a : r.b).code).length);

  const th = 'border-b border-border py-1.5 pr-3 text-left text-xs font-semibold';
  const td = 'border-b border-border py-1 pr-3 align-top text-sm';
  const running = (who: string) => (
    // In <thead>, so it repeats at the top of every printed page.
    <tr>
      <th colSpan={6} className="pb-2 text-left text-[11px] font-normal text-muted">
        {who} · {title} · {ctx.couple.match_type === 'main' ? 'Main Residency Match' : ctx.couple.match_name} {ctx.couple.match_year} · printed{' '}
        <LocalTime iso={new Date().toISOString()} />
      </th>
    </tr>
  );

  return (
    <main id="main" tabIndex={-1} className="outline-none mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href={version ? '/app' : '/app/list'} className={buttonVariants({ variant: 'secondary' })}>Back</Link>
        <PrintButton />
      </div>
      <p className="mb-6 flex items-start gap-2 rounded-2xl border border-glass-border bg-warn-soft/85 px-4 py-3 text-sm text-warn print:hidden" role="note">
        <Laptop className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Saving as a PDF works best on a computer. On a phone the print dialog can shrink or cut off the tables; if it does, use
          the CSV export instead.
        </span>
      </p>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Couples rank list — {names[0]} &amp; {names[1]}</h1>
        <p className="text-sm text-muted">
          {title}
          {savedAt ? (
            <>
              {' '}
              (saved <LocalTime iso={savedAt} />)
            </>
          ) : null}{' '}
          · {rows.length} ranks · {ctx.couple.match_type === 'main' ? 'Main Residency Match' : ctx.couple.match_name} {ctx.couple.match_year}
        </p>
        <p className="mt-2 text-xs text-muted">
          A planning tool, not affiliated with the NRMP. Enter each row into R3 in this order, tick it off, and certify it yourselves.
        </p>
      </header>

      {missing.some((m) => m > 0) ? (
        <p className="mb-6 rounded-lg border-2 border-warn px-3 py-2 text-sm font-medium text-warn" data-testid="missing-codes">
          {([0, 1] as const)
            .filter((k) => missing[k] > 0)
            .map((k) => `${names[k]}: ${missing[k]} row${missing[k] === 1 ? '' : 's'} without an NRMP code`)
            .join(' · ')}
          . They’re marked “MISSING” below; add the codes on the Rank step before you enter the list in R3.
        </p>
      ) : null}

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 font-semibold">Before you certify</h2>
        <ul className="text-sm">
          {checklist.map((c) => (
            <li key={c.label}>
              {c.ok ? '☑' : '☐'} {c.label}
              {c.detail ? <span className="text-muted"> — {c.detail}</span> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          Estimated fees: {names[0]} ${fees.partners[0].totalUsd}, {names[1]} ${fees.partners[1].totalUsd} (estimate; base fees not included).
        </p>
      </section>

      {([0, 1] as const).map((k) => (
        <section key={k} className="mb-8 break-before-page first-of-type:break-before-auto" data-testid={`print-partner-${k}`}>
          <h2 className="mb-2 font-semibold">{names[k]}’s R3 entries</h2>
          <table className="w-full border-collapse">
            <thead>
              {running(`${names[k]}’s R3 entries`)}
              <tr>
                <th className={th}>Rank</th>
                <th className={th}>Program</th>
                <th className={th}>NRMP code</th>
                <th className={`${th} w-16 text-center`}>Entered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = k === 0 ? r.a : r.b;
                const isMissing = s.id !== NO_MATCH && !s.code;
                return (
                  <tr key={r.pairId} className="break-inside-avoid">
                    <td className={td}>{r.rank}</td>
                    <td className={td}>{s.name}</td>
                    <td className={`${td} font-mono`}>
                      {isMissing ? <span className="rounded border-2 border-warn px-1 font-sans text-xs font-bold text-warn">MISSING</span> : s.code}
                    </td>
                    <td className={`${td} text-center text-base`} aria-label="Entered in R3">☐</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section className="break-before-page">
        <h2 className="mb-2 font-semibold">Both partners, side by side</h2>
        <table className="w-full border-collapse">
          <thead>
            {running('Both partners')}
            <tr>
              <th className={th}>Rank</th>
              <th className={th}>{names[0]}</th>
              <th className={th}>Code</th>
              <th className={th}>{names[1]}</th>
              <th className={th}>Code</th>
              <th className={th}>Distance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pairId} className="break-inside-avoid">
                <td className={td}>{r.rank}</td>
                <td className={td}>{r.a.name}</td>
                <td className={`${td} font-mono`}>{r.a.code || (r.a.id === NO_MATCH ? '' : 'MISSING')}</td>
                <td className={td}>{r.b.name}</td>
                <td className={`${td} font-mono`}>{r.b.code || (r.b.id === NO_MATCH ? '' : 'MISSING')}</td>
                <td className={td}>
                  {r.bandLabel}
                  {r.distanceMi != null ? ` · ${Math.round(r.distanceMi)} mi` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
