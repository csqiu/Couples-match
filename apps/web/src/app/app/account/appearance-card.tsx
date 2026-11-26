'use client';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LookPreview, LookSwatch } from '@/components/look-preview';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { applyLook, DEFAULT_LOOK, lookId, lookName, parseLookId, savedLook, savedLookList, type Look, type SavedLookList } from '@/lib/looks';

const SHOWN = 5;

/** Account › Appearance: the look in use, and the list from the theme warm-up to switch between. */
export function AppearanceCard() {
  const [current, setCurrent] = useState<Look>(DEFAULT_LOOK);
  const [list, setList] = useState<SavedLookList | null>(null);
  const [all, setAll] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const sync = () => {
      setCurrent(savedLook());
      setList(savedLookList());
    };
    sync();
    window.addEventListener('pairwise-look', sync);
    return () => window.removeEventListener('pairwise-look', sync);
  }, []);

  const use = (look: Look) => {
    applyLook(look);
    toast({ message: `Pairwise now uses ${lookName(look)}.` });
  };
  const looks = (list?.order ?? []).map(parseLookId).filter((l): l is Look => !!l);
  const currentId = lookId(current);

  return (
    <Card id="appearance">
      <CardHeader
        title="Appearance"
        description="How Pairwise looks for you on this device. Your partner picks their own. Light and dark mode are in the header."
      />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <LookPreview look={current} />
          <p className="text-sm">
            <span className="font-medium">{lookName(current)}</span>
            {currentId === lookId(DEFAULT_LOOK) ? <span className="text-muted"> (the default)</span> : null}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {looks.length ? (
            <>
              <p className="text-[13.5px] text-muted">Your themes, from the warm-up{list?.at ? ` on ${new Date(list.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.</p>
              <ol className="flex flex-col gap-1.5">
                {(all ? looks : looks.slice(0, SHOWN)).map((look, i) => {
                  const inUse = lookId(look) === currentId;
                  return (
                    <li key={lookId(look)} className={cn('glass-row flex items-center gap-3 px-2 py-1.5', inUse && 'border-action bg-surface')}>
                      <span className="w-6 text-right font-mono text-sm font-semibold text-plum-deep">{i + 1}</span>
                      <LookSwatch font={look.font} palette={look.palette} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{lookName(look)}</span>
                      {inUse ? (
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">In use</span>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => use(look)} aria-label={`Use ${lookName(look)}`}>Use</Button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {looks.length > SHOWN ? (
                <button className="self-start text-sm text-accent underline" onClick={() => setAll(!all)}>
                  {all ? 'Show fewer' : `Show all ${looks.length}`}
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">
              Try the theme warm-up: rank four fonts and four color schemes, answer a few “this or that” questions, and get all
              16 looks in order. It works just like your Match list.
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href="/warmup" className={buttonVariants({ variant: looks.length ? 'secondary' : 'primary', size: 'sm' })}>
              {looks.length ? 'Redo the warm-up' : 'Start the warm-up'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {currentId !== lookId(DEFAULT_LOOK) ? (
              <Button variant="ghost" size="sm" onClick={() => use(DEFAULT_LOOK)}>Use the default look</Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
