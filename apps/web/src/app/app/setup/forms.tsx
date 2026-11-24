'use client';
import { Check, Copy } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { invitePartner, newInviteLink, revokeInvite, saveProfile, saveSettings, startCouple, type FormState } from './actions';

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-danger" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-accent" role="status">{state.ok}</p>;
  return null;
}

export interface SpecialtyOption {
  code: string;
  name: string;
  group: string;
}

export function ProfileForm({
  displayName,
  specialty,
  specialties,
}: {
  displayName: string;
  specialty: string | null;
  specialties: SpecialtyOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  // Controlled, so the fields keep what was saved: React resets a form after its action runs.
  const [name, setName] = useState(displayName);
  const [spec, setSpec] = useState(specialty ?? '');
  const groups = [...new Set(specialties.map((s) => s.group))];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Your name" htmlFor="display_name" hint="Shown to your partner.">
        <Input id="display_name" name="display_name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </Field>
      <Field label="Your specialty" htmlFor="specialty" hint="Decides which NRMP match you’re in.">
        <Select id="specialty" name="specialty" value={spec} onChange={(e) => setSpec(e.target.value)} required>
          <option value="" disabled>Choose…</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {specialties.filter((s) => s.group === g).map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function StartCoupleForm({ years, matchLabel }: { years: number[]; matchLabel: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(startCouple, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">You’ll be in <strong className="text-text">{matchLabel}</strong>. Your partner must be in the same match.</p>
      <Field label="Match year" htmlFor="match_year" hint="The March you’ll match.">
        <Select id="match_year" name="match_year" defaultValue={years[0]} className="sm:max-w-48">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </Field>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? 'Starting…' : 'Start our couple'}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function InviteForm({ openInvite }: { openInvite: { id: string; email: string; expires_at: string } | null }) {
  const [sent, action, pending] = useActionState<FormState, FormData>(invitePartner, {});
  const [made, linkAction, linkPending] = useActionState<FormState, FormData>(newInviteLink, {});
  // Whichever button was used last decides what's shown.
  const [last, setLast] = useState<'send' | 'link'>('send');
  const state = last === 'link' ? made : sent;
  const [email, setEmail] = useState(openInvite?.email ?? '');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {openInvite ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
          <span>
            Waiting for <strong>{openInvite.email}</strong> · expires {new Date(openInvite.expires_at).toLocaleDateString()}
          </span>
          <form action={revokeInvite.bind(null, openInvite.id)}>
            <Button variant="ghost" size="sm" type="submit">Cancel invite</Button>
          </form>
        </div>
      ) : null}
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label={openInvite ? 'Send a new invite' : 'Your partner’s email'} htmlFor="invite-email" hint="They must sign in with this exact address. A new invite or link cancels the previous one.">
            <Input id="invite-email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@school.edu" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 sm:mb-6">
          <Button type="submit" disabled={pending || linkPending} onClick={() => setLast('send')}>
            {pending ? 'Sending…' : openInvite ? 'Resend invite' : 'Send invite'}
          </Button>
          <Button type="submit" variant="secondary" formAction={linkAction} disabled={pending || linkPending} onClick={() => { setLast('link'); setCopied(false); }}>
            {linkPending ? 'Creating…' : 'Create new link'}
          </Button>
        </div>
      </form>
      <Status state={state} />
      {state.inviteLink ? (
        <div className="flex items-center gap-2">
          <Input readOnly value={state.inviteLink} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Copy invite link"
            onClick={async () => {
              await navigator.clipboard.writeText(state.inviteLink!);
              setCopied(true);
            }}
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SettingsForm({
  privacy,
  answerMode,
  bands,
}: {
  privacy: 'shared' | 'private_tiers';
  answerMode: 'together' | 'separately';
  bands: { togetherMi: number; commutableMi: number; drivableMi: number };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  // Controlled, so the form keeps what was saved: React resets a form after its action runs.
  const [values, setValues] = useState({ privacy, answerMode, ...bands });
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What your partner sees</legend>
        <Radio name="privacy" value="shared" checked={values.privacy === 'shared'} onChange={set('privacy')} title="Everything" body="You both see each other’s programs and tiers." />
        <Radio name="privacy" value="private_tiers" checked={values.privacy === 'private_tiers'} onChange={set('privacy')} title="Private tiers" body="Your tiers still shape the list, but your partner doesn’t see them." />
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Answering “this or that”</legend>
        <Radio name="answerMode" value="together" checked={values.answerMode === 'together'} onChange={set('answerMode')} title="Together" body="You answer each question as a couple." />
        <Radio name="answerMode" value="separately" checked={values.answerMode === 'separately'} onChange={set('answerMode')} title="Separately" body="You each answer; disagreements go to a discussion queue." />
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">How far is “close”? (miles)</legend>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Together" htmlFor="togetherMi" hint="or same metro">
            <Input id="togetherMi" name="togetherMi" type="number" min={1} inputMode="numeric" value={values.togetherMi} onChange={set('togetherMi')} />
          </Field>
          <Field label="Commutable" htmlFor="commutableMi">
            <Input id="commutableMi" name="commutableMi" type="number" min={1} inputMode="numeric" value={values.commutableMi} onChange={set('commutableMi')} />
          </Field>
          <Field label="Drivable" htmlFor="drivableMi" hint="beyond = Apart">
            <Input id="drivableMi" name="drivableMi" type="number" min={1} inputMode="numeric" value={values.drivableMi} onChange={set('drivableMi')} />
          </Field>
        </div>
      </fieldset>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

function Radio({ name, value, checked, onChange, title, body }: { name: string; value: string; checked: boolean; onChange: (e: { target: { value: string } }) => void; title: string; body: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 accent-[var(--accent)]" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{body}</span>
      </span>
    </label>
  );
}
