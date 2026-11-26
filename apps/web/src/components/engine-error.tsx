'use client';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/**
 * The engine couldn't work out this page (bug log #32): say so and offer to try again,
 * instead of a loading box that never ends. `stale`: older results are still shown below.
 */
export function EngineError({ error, onRetry, stale = false, className }: { error: string; onRetry: () => void; stale?: boolean; className?: string }) {
  return (
    <div role="alert" data-testid="engine-error" className={cn('flex flex-wrap items-start gap-3 rounded-[20px] border border-warn/60 bg-warn-soft/85 p-4 text-sm text-warn', className)}>
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{stale ? 'Couldn’t update this page' : 'Couldn’t work this out'}</p>
        <p className="mt-0.5 text-text/80">
          {stale ? 'What you see may be out of date. ' : ''}Something went wrong while calculating ({error}). Your answers and lists are saved.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        <RotateCcw className="h-4 w-4" aria-hidden /> Try again
      </Button>
    </div>
  );
}
