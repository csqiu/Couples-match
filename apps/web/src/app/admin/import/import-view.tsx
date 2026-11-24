'use client';
import type { ProgramRecord } from '@pairwise/data';
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { commitImport, previewImport, type ImportPreview } from '../actions';

const COLUMNS = 'name, institution, specialty, street, city, state, zip, acgme_id, is_advanced, source_id';

const REASON: Record<string, string> = {
  no_geocode: 'No location',
  low_confidence: 'Location may be off',
  outside_cbsa: 'Outside every metro area',
};

export function ImportView() {
  const id = useId();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [saved, setSaved] = useState<{ inserted: number; updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  async function onFile(f: File | undefined) {
    if (!f) return;
    setCsv(await f.text());
    setFileName(f.name);
    setSource((s) => s || f.name.replace(/\.csv$/i, ''));
    setPreview(null);
    setSaved(null);
  }

  const flagged = preview?.programs.filter((p) => p.reasons.length) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import programs</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Upload a spreadsheet saved as CSV. Each row is looked up on the map, its specialty matched to our list, and checked against
          programs already listed. Nothing is saved until you confirm. Only import from sources we’re allowed to use
          (see docs/data-sources.md).
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:p-4">
        <p className="text-sm">
          Columns (first row): <code className="rounded bg-surface-2 px-1 text-xs">{COLUMNS}</code>. Only name, specialty, city and state are required. Up to 300 rows per file.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CSV file" htmlFor={`${id}-file`}>
            <Input id={`${id}-file`} type="file" accept=".csv,text/csv" className="py-2" onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
          <Field label="Source name" htmlFor={`${id}-src`} hint="Where the data came from; recorded on every program.">
            <Input id={`${id}-src`} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. acgme-2027" />
          </Field>
        </div>
        <Button
          className="self-start"
          disabled={!csv || busy}
          onClick={() =>
            start(async () => {
              setError(null);
              setSaved(null);
              const res = await previewImport(csv, source);
              if (res.error) setError(res.error);
              setPreview(res.error ? null : res);
            })
          }
        >
          <Upload className="h-4 w-4" aria-hidden /> {busy && !preview ? 'Finding programs on the map… (about a second a row)' : `Check ${fileName || 'file'}`}
        </Button>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      </Card>

      {saved ? (
        <Card className="p-4 text-sm sm:p-4" role="status">
          Saved: {saved.inserted} new, {saved.updated} updated. Anything flagged is now in the{' '}
          <Link href="/admin" className="text-accent underline">review queue</Link>.
        </Card>
      ) : null}

      {preview && !saved ? (
        <Card className="flex flex-col gap-4 p-4 sm:p-4" data-testid="import-preview">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{preview.rows}</strong> rows → <strong>{preview.programs.filter((p) => !p.isUpdate).length}</strong> new,{' '}
              <strong>{preview.programs.filter((p) => p.isUpdate).length}</strong> updates, <strong>{flagged.length}</strong> flagged for review,{' '}
              <strong>{preview.duplicates.length}</strong> skipped as possible duplicates, <strong>{preview.rejected.length}</strong> rejected.
            </p>
            <Button
              disabled={busy || !preview.programs.length}
              onClick={() =>
                start(async () => {
                  const programs: ProgramRecord[] = preview.programs.map(({ isUpdate: _u, reasons: _r, ...p }) => p);
                  const res = await commitImport(programs);
                  if (res.error) setError(res.error);
                  else setSaved({ inserted: res.inserted ?? 0, updated: res.updated ?? 0 });
                })
              }
            >
              Save {preview.programs.length} programs
            </Button>
          </div>

          <Section title="Programs to save">
            {preview.programs.map((p) => (
              <Row key={p.id} name={p.name} detail={`${p.specialtyName} · ${p.address}`}>
                {p.isUpdate ? <Badge>Update</Badge> : <Badge tone="accent">New</Badge>}
                {p.reasons.map((r) => <Badge key={r} tone="warn">{REASON[r] ?? r}</Badge>)}
              </Row>
            ))}
          </Section>
          {preview.duplicates.length ? (
            <Section title="Skipped: looks like a program already listed">
              {preview.duplicates.map((d, i) => (
                <Row key={i} name={d.program.name} detail={`${d.program.address} · matches ${d.duplicateOf}`} />
              ))}
            </Section>
          ) : null}
          {preview.rejected.length ? (
            <Section title="Rejected">
              {preview.rejected.map((r) => (
                <Row key={r.line} name={`Row ${r.line}: ${r.name}`} detail={r.reason} />
              ))}
            </Section>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">{children}</ul>
    </section>
  );
}

function Row({ name, detail, children }: { name: string; detail: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block truncate text-xs text-muted">{detail}</span>
      </span>
      {children ? <span className="flex shrink-0 gap-1">{children}</span> : null}
    </li>
  );
}
