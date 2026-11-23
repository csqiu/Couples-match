'use client';
import { Pencil, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { renameVersion, restoreVersion } from './actions';

export function VersionControls({ id, name, note }: { id: string; name: string; note: string | null }) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(name);
  const [t, setT] = useState(note ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (editing) {
    return (
      <form
        className="flex w-full flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await renameVersion(id, n, t);
          if (res.error) toast({ message: res.error });
          else setEditing(false);
        }}
      >
        <Input aria-label="Version name" value={n} onChange={(e) => setN(e.target.value)} required maxLength={120} />
        <Input aria-label="Version note" value={t} onChange={(e) => setT(e.target.value)} placeholder="Note" />
        <Button type="submit" size="sm">Save</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Rename ${name}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
      </Button>
      {confirming ? (
        <span className="flex items-center gap-1 text-xs">
          Replace your current list? (It’s saved as a version first.)
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await restoreVersion(id, name);
              setBusy(false);
              setConfirming(false);
              toast({ message: res.error ? res.error : `Restored “${name}”.` });
            }}
          >
            {busy ? 'Restoring…' : 'Restore'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Restore ${name}`}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restore
        </Button>
      )}
    </div>
  );
}
