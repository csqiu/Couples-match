'use client';
import { MapPin, Plus } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { addNewProgram, type NewProgram, type NewProgramResult } from './actions';
import type { ProgramLite } from './types';

type Similar = Extract<NewProgramResult, { status: 'similar' }>['similar'];

/** "Can't find a program? Add it": saved privately for the couple until an admin reviews it. */
export function AddProgramForm({
  specialties,
  defaultSpecialty,
  initialName,
  onAddExisting,
}: {
  specialties: Array<{ code: string; name: string }>;
  defaultSpecialty: string;
  initialName: string;
  onAddExisting: (p: ProgramLite) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewProgram>({ name: '', institution: '', specialty: defaultSpecialty, street: '', city: '', state: '', zip: '' });
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [similar, setSimilar] = useState<Similar | null>(null);
  const [saving, startSave] = useTransition();
  const toast = useToast();

  const set = (k: keyof NewProgram) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setNotFound(false);
    setSimilar(null);
  };

  function submit(extra: Partial<NewProgram> = {}) {
    setError(null);
    startSave(async () => {
      const res = await addNewProgram({ ...form, ...extra });
      if (res.status === 'error') setError(res.error);
      else if (res.status === 'not_found') setNotFound(true);
      else if (res.status === 'similar') setSimilar(res.similar);
      else {
        toast({ message: `Added ${res.program.name}. It’s on your list; an admin will check it.` });
        setForm((f) => ({ ...f, name: '', institution: '', street: '', zip: '' }));
        setNotFound(false);
        setSimilar(null);
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-surface-2 px-3.5 py-2.5 text-sm">
        <span className="text-muted">Can’t find a program?</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setForm((f) => ({ ...f, name: f.name || initialName }));
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Add a program not listed
        </Button>
      </div>
    );
  }

  return (
    <form
      className="glass-row flex flex-col gap-3 p-3.5"
      aria-label="Add a program not listed"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <h2 className="small-title">Add a program not listed</h2>
        <p className="text-xs text-muted">Only you and your partner will see it until we’ve checked it. We use the address to work out distances.</p>
      </div>
      <Field label="Program name" htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} value={form.name} onChange={set('name')} placeholder="e.g. Tufts Medical Center Internal Medicine" required minLength={3} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hospital or institution" htmlFor={`${id}-inst`} hint="Optional">
          <Input id={`${id}-inst`} value={form.institution} onChange={set('institution')} />
        </Field>
        <Field label="Specialty" htmlFor={`${id}-spec`}>
          <Select id={`${id}-spec`} value={form.specialty} onChange={set('specialty')}>
            {specialties.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Street address" htmlFor={`${id}-street`} hint="The main hospital where residents work">
        <Input id={`${id}-street`} value={form.street} onChange={set('street')} autoComplete="street-address" />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-3">
        <Field label="City" htmlFor={`${id}-city`}>
          <Input id={`${id}-city`} value={form.city} onChange={set('city')} required />
        </Field>
        <Field label="State" htmlFor={`${id}-state`}>
          <Input id={`${id}-state`} value={form.state} onChange={set('state')} required maxLength={2} placeholder="MA" className="uppercase" />
        </Field>
        <Field label="ZIP" htmlFor={`${id}-zip`}>
          <Input id={`${id}-zip`} value={form.zip} onChange={set('zip')} inputMode="numeric" maxLength={10} />
        </Field>
      </div>

      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}

      {notFound ? (
        <div className="rounded-[14px] bg-warn-soft/85 p-3 text-sm" role="alert">
          <p className="font-medium">We couldn’t find that address on the map.</p>
          <p className="mt-1 text-muted">Check the street and city. You can also save it without a location, but then the app can’t tell how far apart you’d be.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-2" disabled={saving} onClick={() => submit({ allowNoLocation: true })}>
            Save without a location
          </Button>
        </div>
      ) : null}

      {similar ? (
        <div className="rounded-[14px] bg-accent-soft/80 p-3 text-sm" role="alert">
          <p className="font-medium">Is it one of these? They’re already listed, within a mile.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {similar.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3" aria-hidden /> {p.city}, {p.state} · {p.distanceMi < 0.1 ? 'same address' : `${p.distanceMi.toFixed(1)} mi away`}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    startSave(async () => {
                      await onAddExisting(p);
                      setOpen(false);
                      setSimilar(null);
                    })
                  }
                >
                  Use this one
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={saving} onClick={() => submit({ notADuplicate: true })}>
            No, add mine
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={saving || !!similar || notFound}>{saving ? 'Finding it on the map…' : 'Add program'}</Button>
      </div>
    </form>
  );
}
