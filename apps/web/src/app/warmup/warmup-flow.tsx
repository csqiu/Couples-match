'use client';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Check, ChevronDown, ChevronUp, GripVertical, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { LookPreview, LookSwatch } from '@/components/look-preview';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import {
  applyLook,
  DEFAULT_LOOK,
  fontOf,
  FONTS,
  lookId,
  lookName,
  paletteOf,
  PALETTES,
  readWarmupProgress,
  savedLook,
  saveLookList,
  saveWarmupProgress,
  type FontId,
  type Look,
  type PaletteId,
} from '@/lib/looks';
import { runWarmup, WARMUP_MAX_QUESTIONS, type WarmupAnswer } from '@/lib/warmup';

const STEPS = [
  { id: 'intro', n: 'i', label: 'How it works' },
  { id: 'fonts', n: '1', label: 'Fonts' },
  { id: 'colors', n: '2', label: 'Colors' },
  { id: 'compare', n: '3', label: 'This or that' },
  { id: 'themes', n: '4', label: 'Your themes' },
] as const;
type Step = (typeof STEPS)[number]['id'];

interface Progress {
  step: Step;
  /** Furthest step reached (index into STEPS). */
  reached: number;
  fonts: FontId[];
  palettes: PaletteId[];
  answers: WarmupAnswer[];
}

const START: Progress = { step: 'intro', reached: 0, fonts: FONTS.map((f) => f.id), palettes: PALETTES.map((p) => p.id), answers: [] };

export function WarmupFlow({ signedIn }: { signedIn: boolean }) {
  const [p, setP] = useState<Progress>(START);
  const [current, setCurrent] = useState<Look>(DEFAULT_LOOK);
  const toast = useToast();

  // Pick up where this device left off, and follow the look if it changes elsewhere.
  useEffect(() => {
    const saved = readWarmupProgress<Progress>();
    if (saved && STEPS.some((s) => s.id === saved.step) && saved.fonts?.length === FONTS.length && saved.palettes?.length === PALETTES.length) {
      setP({ ...START, ...saved, answers: saved.answers ?? [] });
    }
    const sync = () => setCurrent(savedLook());
    sync();
    window.addEventListener('pairwise-look', sync);
    return () => window.removeEventListener('pairwise-look', sync);
  }, []);

  const update = (next: Partial<Progress>) =>
    setP((prev) => {
      const merged = { ...prev, ...next };
      const idx = STEPS.findIndex((s) => s.id === merged.step);
      merged.reached = Math.max(merged.reached, idx);
      saveWarmupProgress(merged);
      return merged;
    });
  const go = (step: Step) => {
    update({ step });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const result = useMemo(() => runWarmup({ fonts: p.fonts, palettes: p.palettes, answers: p.answers }), [p.fonts, p.palettes, p.answers]);

  function finish() {
    const order = result.order.map(lookId);
    saveLookList({ order, fonts: p.fonts, palettes: p.palettes, at: new Date().toISOString() });
    applyLook(result.order[0]);
    toast({ message: `Pairwise now uses your #1 theme: ${lookName(result.order[0])}.` });
    go('themes');
  }

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Warm-up steps" className="glass max-w-full self-start overflow-x-auto rounded-full p-1.5">
        <ol className="flex min-w-max gap-1">
          {STEPS.map((s, i) => {
            const isCurrent = p.step === s.id;
            const isDone = i < p.reached && !isCurrent;
            const locked = i > p.reached;
            const inner = (
              <>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold',
                    isCurrent ? 'bg-action text-action-fg' : isDone ? 'bg-accent-soft text-accent' : 'bg-text/6 text-muted',
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" aria-hidden /> : s.n}
                </span>
                <span className={cn('text-sm', isCurrent ? 'font-semibold text-text' : 'text-muted')}>{s.label}</span>
              </>
            );
            return (
              <li key={s.id}>
                {locked ? (
                  <span className="flex min-h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 opacity-50" aria-disabled>{inner}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => (s.id === 'themes' && p.step !== 'themes' ? finish() : go(s.id))}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn('flex min-h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 transition-colors duration-150', isCurrent ? 'bg-surface shadow-soft' : 'hover:bg-glass-strong')}
                  >
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {p.step === 'intro' ? <Intro fonts={p.fonts} palettes={p.palettes} onStart={() => go('fonts')} /> : null}

      {p.step === 'fonts' ? (
        <RankStep
          eyebrow="Warm-up · step 1 of 4"
          title="Rank the fonts"
          lead="Put them in your true order, favorite on top. Drag the handle, or use the arrows. In the real thing you’ll do this with programs."
          aside="Fonts are shown in the colors you’re using now, so color doesn’t sway you."
          ids={p.fonts}
          onChange={(fonts) => update({ fonts: fonts as FontId[], answers: [] })}
          render={(id) => <FontRow id={id as FontId} />}
          label={(id) => fontOf(id as FontId).name}
          next={<Button onClick={() => go('colors')}>Next: rank colors <ArrowRight className="h-4 w-4" aria-hidden /></Button>}
        />
      ) : null}

      {p.step === 'colors' ? (
        <RankStep
          eyebrow="Warm-up · step 2 of 4"
          title="Rank the color schemes"
          lead="Same again: favorite on top. Each one is shown in the same font so the font doesn’t sway you."
          aside="Every scheme keeps buttons in a neutral ink and gives each partner their own color, so you two are always easy to tell apart."
          ids={p.palettes}
          onChange={(palettes) => update({ palettes: palettes as PaletteId[], answers: [] })}
          render={(id) => <PaletteRow id={id as PaletteId} font={current.font} />}
          label={(id) => paletteOf(id as PaletteId).name}
          next={<Button onClick={() => go('compare')}>Next: this or that <ArrowRight className="h-4 w-4" aria-hidden /></Button>}
        />
      ) : null}

      {p.step === 'compare' ? (
        <Compare
          fonts={p.fonts}
          palettes={p.palettes}
          answers={p.answers}
          result={result}
          onAnswer={(a) => update({ answers: [...p.answers, a] })}
          onUndo={() => update({ answers: p.answers.slice(0, -1) })}
          onFinish={finish}
        />
      ) : null}

      {p.step === 'themes' ? (
        <Themes
          order={result.order}
          fonts={p.fonts}
          palettes={p.palettes}
          current={current}
          signedIn={signedIn}
          onUse={(look) => {
            applyLook(look);
            toast({ message: `Pairwise now uses ${lookName(look)}.` });
          }}
          onRestart={() => {
            saveWarmupProgress(null);
            setP(START);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onMore={() => go('compare')}
          canAskMore={!!result.question}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro

function Intro({ fonts, palettes, onStart }: { fonts: FontId[]; palettes: PaletteId[]; onStart: () => void }) {
  const rows: Array<[string, string, string, string]> = [
    ['1', 'Rank 4 fonts', 'One partner ranks their programs', 'Every program they’d be willing to go to, in true order.'],
    ['2', 'Rank 4 color schemes', 'The other partner ranks theirs', 'Separately, in their own order.'],
    ['×', '4 × 4 = 16 combinations', 'Every possible pair', 'Each of your programs with each of your partner’s, plus No Match.'],
    ['=', 'Obvious ones are settled for you: your #1 font in your #1 colors beats your #2 in your #2s.', 'Common sense comes first', 'A pair that’s better for both of you, and no farther apart, always ranks higher.'],
    ['3', 'This or that: “Your top font in your #3 colors, or your #2 of each?”', 'This or that', '“Both at your #1s but far apart, or both at your #3s in one city?”'],
    ['4', 'Your themes, in order. Use any of them.', 'Your final list', 'One ordered list of pairs, ready to type into R3.'],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-3xl">
        <p className="eyebrow text-muted">Warm-up · about 2 minutes · no account needed</p>
        <h1 className="mt-3 font-display text-[34px] leading-[1.06] font-semibold tracking-[-0.025em] sm:text-[40px]">
          Pick your look the same way you’ll pick your programs.
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          Rank four fonts, rank four color schemes, then answer a few “this or that” questions. You get all 16 combinations
          in order, and the top one becomes how Pairwise looks for you on this device.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <h2 className="card-title mb-3">How it mirrors the Couples Match</h2>
          <div className="mb-1 hidden grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-3 font-mono text-[11px] tracking-[0.08em] text-muted uppercase sm:grid">
            <span />
            <span>In the warm-up</span>
            <span>In the real thing</span>
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map(([k, warm, real, detail]) => (
              <li key={k} className="glass-row grid gap-x-3 gap-y-1 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)]">
                <span className="font-mono text-sm font-semibold">{k}</span>
                <span className="text-sm font-medium">{warm}</span>
                <span className="text-sm">
                  <span className="font-medium">{real}</span>
                  <span className="block text-[13px] text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-col gap-5">
          <Card tone="strong">
            <h2 className="small-title">All 16 combinations</h2>
            <p className="mt-1 mb-4 text-[13px] text-muted">
              Fonts down the side, colors across the top. The corner is first without asking; the questions settle the rest.
            </p>
            <div className="grid grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] items-center gap-2" aria-hidden>
              <span />
              {palettes.map((pal, j) => (
                <span key={pal} className="flex flex-col items-center gap-1 text-center font-mono text-[11px] text-muted">
                  <span data-palette={pal} className="flex h-3 w-full overflow-hidden rounded-[5px]">
                    <i className="flex-1 bg-partner-1" />
                    <i className="flex-1 bg-partner-2" />
                  </span>
                  {j === 0 ? 'Colors #1' : `#${j + 1}`}
                </span>
              ))}
              {fonts.map((f, i) => (
                <FontGridRow key={f} font={f} i={i} palettes={palettes} />
              ))}
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <p className="text-[13.5px] text-muted">
              In the real thing there are two of you, and distance matters too. The steps and the questions work the same way.
            </p>
            <Button className="self-start" onClick={onStart}>
              Start: rank the fonts <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FontGridRow({ font, i, palettes }: { font: FontId; i: number; palettes: PaletteId[] }) {
  return (
    <>
      <span data-font={font} className="flex flex-col font-mono text-[11px] text-muted">
        <span className="font-display text-[22px] leading-none font-semibold text-text">Aa</span>
        {i === 0 ? 'Font #1' : `#${i + 1}`}
      </span>
      {palettes.map((pal, j) => (
        <span key={pal} className={cn('flex justify-center rounded-[12px] p-1', i === 0 && j === 0 && 'ring-2 ring-action')}>
          <LookSwatch font={font} palette={pal} className="w-full" />
        </span>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Ranking (the Rank step, without tiers)

function RankStep({
  eyebrow,
  title,
  lead,
  aside,
  ids,
  onChange,
  render,
  label,
  next,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  aside: string;
  ids: string[];
  onChange: (ids: string[]) => void;
  render: (id: string) => ReactNode;
  label: (id: string) => string;
  next: ReactNode;
}) {
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };
  const nudge = (id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    onChange(arrayMove(ids, i, j));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">{eyebrow}</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{lead}</p>
        </div>
        {next}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: {
              draggable: 'To pick up an item, press space or enter. Use the arrow keys to move it. Press space or enter to drop, or escape to cancel.',
            },
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="glass flex flex-col gap-2 p-3 sm:p-4">
              {ids.map((id, i) => (
                <SortableRow key={id} id={id} rank={i + 1} label={label(id)} first={i === 0} last={i === ids.length - 1} onNudge={(d) => nudge(id, d)}>
                  {render(id)}
                </SortableRow>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
        <Card tone="strong" className="flex flex-col gap-3 self-start">
          <p className="eyebrow text-muted">How the warm-up works</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Rank 4 fonts</li>
            <li>Rank 4 color schemes</li>
            <li>A few “this or that” questions</li>
            <li>All 16 combinations, in order</li>
          </ol>
          <p className="text-[13px] text-muted">{aside}</p>
        </Card>
      </div>
    </div>
  );
}

function SortableRow({ id, rank, label, first, last, onNudge, children }: { id: string; rank: number; label: string; first: boolean; last: boolean; onNudge: (d: -1 | 1) => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('glass-row flex flex-wrap items-center gap-2 py-2 pr-2 pl-1 sm:flex-nowrap', isDragging && 'relative z-10 border-action bg-surface shadow-glass')}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex min-h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-[10px] text-muted hover:bg-glass-strong active:cursor-grabbing"
        aria-label={`Drag ${label}, ranked ${rank}`}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-right font-mono text-[15px] font-semibold tabular-nums text-plum-deep" aria-label={`Rank ${rank}`}>{rank}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="flex shrink-0 flex-col">
        <button className="flex h-5.5 w-9 items-center justify-center rounded-md text-muted hover:bg-glass-strong disabled:opacity-30" disabled={first} onClick={() => onNudge(-1)} aria-label={`Move ${label} up`}>
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
        <button className="flex h-5.5 w-9 items-center justify-center rounded-md text-muted hover:bg-glass-strong disabled:opacity-30" disabled={last} onClick={() => onNudge(1)} aria-label={`Move ${label} down`}>
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </span>
    </li>
  );
}

function FontRow({ id }: { id: FontId }) {
  const f = fontOf(id);
  return (
    <div data-font={id} className="flex items-center gap-4 py-1">
      <span className="hidden w-16 shrink-0 font-display text-[36px] leading-none font-semibold tracking-[-0.02em] sm:block" aria-hidden>Aa</span>
      <div className="min-w-0">
        <p className="font-display text-[18px] leading-tight font-semibold tracking-[-0.01em]">The smart way to couples match.</p>
        <p className="mt-0.5 text-sm text-muted">
          <span className="font-semibold text-text">{f.name}</span> · {f.faces}. {f.blurb}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted">#1 UCSF · 34 mi · 0123456789</p>
      </div>
    </div>
  );
}

function PaletteRow({ id, font }: { id: PaletteId; font: FontId }) {
  const pal = paletteOf(id);
  return (
    <div className="flex flex-wrap items-center gap-4 py-1">
      <div className="min-w-0 flex-[1_1_12rem]">
        <p className="font-semibold">{pal.name}</p>
        <p className="text-sm text-muted">{pal.blurb}</p>
        <span data-palette={id} className="mt-2 flex h-7 w-44 overflow-hidden rounded-[8px] border border-border" aria-hidden>
          <i className="flex-1 bg-bg" />
          <i className="flex-1 bg-partner-1" />
          <i className="flex-1 bg-partner-2" />
          <i className="flex-1 bg-action" />
        </span>
      </div>
      <LookPreview look={{ font, palette: id }} size="sm" className="w-full max-w-[250px] sm:w-[250px]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// This or that

function Compare({
  fonts,
  palettes,
  answers,
  result,
  onAnswer,
  onUndo,
  onFinish,
}: {
  fonts: FontId[];
  palettes: PaletteId[];
  answers: WarmupAnswer[];
  result: ReturnType<typeof runWarmup>;
  onAnswer: (a: WarmupAnswer) => void;
  onUndo: () => void;
  onFinish: () => void;
}) {
  const q = result.question;
  const pct = Math.round(result.confidence * 100);
  const answer = (winner: WarmupAnswer['winner']) => q && onAnswer({ left: lookId(q.left), right: lookId(q.right), winner });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">Warm-up · step 3 of 4</p>
          <h1 className="page-title mt-2">Which would you rather look at every day?</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your favorite font and your favorite colors don’t always look best together. Each answer teaches the engine how much
            the font matters against the colors, the way the real questions teach it how much distance matters.
          </p>
        </div>
        <Button variant="secondary" onClick={onFinish}>See your themes</Button>
      </div>

      <div className="glass p-4 sm:p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Theme list confidence</span>
          <span className="font-mono tabular-nums text-muted">{pct}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-text/8" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Theme list confidence">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--partner-1),var(--partner-2))] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          {result.answered} answer{result.answered === 1 ? '' : 's'} so far. The common-sense rule already settles {result.settledByRule} of the 15
          neighbouring places.{q ? ` At most ${WARMUP_MAX_QUESTIONS} questions.` : ''}
        </p>
      </div>

      {q ? (
        <section aria-label="Question" className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <LookChoice look={q.left} fonts={fonts} palettes={palettes} onChoose={() => answer('left')} />
            <div className="flex items-center justify-center">
              <span className="glass glass-strong flex h-[52px] w-[52px] items-center justify-center rounded-full font-display text-base font-semibold text-muted">or</span>
            </div>
            <LookChoice look={q.right} fonts={fonts} palettes={palettes} onChoose={() => answer('right')} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {answers.length ? (
              <Button variant="ghost" onClick={onUndo}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo last
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => answer('tie')}>Too close to call</Button>
          </div>
        </section>
      ) : (
        <div className="glass flex flex-col items-center gap-3 border-dashed p-10 text-center">
          <p className="card-title">That’s all it needs</p>
          <p className="max-w-md text-sm text-muted">Your answers and the common-sense rule settle the order of all 16 looks.</p>
          <div className="flex gap-2">
            {answers.length ? (
              <Button variant="ghost" onClick={onUndo}>
                <Undo2 className="h-4 w-4" aria-hidden /> Undo last
              </Button>
            ) : null}
            <Button onClick={onFinish}>See your themes <ArrowRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LookChoice({ look, fonts, palettes, onChoose }: { look: Look; fonts: FontId[]; palettes: PaletteId[]; onChoose: () => void }) {
  return (
    <div className="glass glass-strong flex flex-col gap-3 p-4 sm:p-5">
      <p className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11.5px]">
          Font #{fonts.indexOf(look.font) + 1} · {fontOf(look.font).name}
        </span>
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[11.5px]">
          Colors #{palettes.indexOf(look.palette) + 1} · {paletteOf(look.palette).name}
        </span>
      </p>
      <LookPreview look={look} size="lg" className="flex-1" />
      <Button className="w-full" onClick={onChoose} aria-label={`Choose ${lookName(look)}`}>
        <Check className="h-4 w-4" aria-hidden /> Choose this pair
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your themes (the final list)

function Themes({
  order,
  fonts,
  palettes,
  current,
  signedIn,
  onUse,
  onRestart,
  onMore,
  canAskMore,
}: {
  order: Look[];
  fonts: FontId[];
  palettes: PaletteId[];
  current: Look;
  signedIn: boolean;
  onUse: (look: Look) => void;
  onRestart: () => void;
  onMore: () => void;
  canAskMore: boolean;
}) {
  const currentId = lookId(current);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-muted">Warm-up · done</p>
          <h1 className="page-title mt-2">Your themes, in order</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            All 16 font and color combinations, ranked from your answers. Use any of them, any time. Find this list again in
            Account › Appearance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAskMore ? <Button variant="secondary" size="sm" onClick={onMore}>Answer more</Button> : null}
          <Button variant="ghost" size="sm" onClick={onRestart}>Start over</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Your themes" className="glass p-2 sm:p-3">
          <div className="mb-2 grid grid-cols-[2rem_4rem_minmax(0,1fr)_auto] gap-x-3 px-2 font-mono text-[11px] tracking-[0.08em] text-muted uppercase sm:grid-cols-[2.25rem_4rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
            <span className="text-right">#</span>
            <span />
            <span>Font</span>
            <span className="hidden sm:block">Colors</span>
            <span />
          </div>
          <ol className="flex flex-col gap-1.5">
            {order.map((look, i) => {
              const inUse = lookId(look) === currentId;
              return (
                <li
                  key={lookId(look)}
                  className={cn(
                    'grid grid-cols-[2rem_4rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[16px] border border-glass-border bg-glass-row px-2 py-2 sm:grid-cols-[2.25rem_4rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem]',
                    inUse && 'border-action bg-surface ring-2 ring-action/20',
                  )}
                >
                  <span className="text-right font-mono text-[15px] font-semibold tabular-nums text-plum-deep">{i + 1}</span>
                  <LookSwatch font={look.font} palette={look.palette} />
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">{fontOf(look.font).name}</span>{' '}
                    <span className="font-mono text-xs text-muted">#{fonts.indexOf(look.font) + 1}</span>
                    <span className="block sm:hidden">
                      <span className="font-semibold">{paletteOf(look.palette).name}</span>{' '}
                      <span className="font-mono text-xs text-muted">#{palettes.indexOf(look.palette) + 1}</span>
                    </span>
                  </span>
                  <span className="hidden min-w-0 text-sm sm:block">
                    <span className="font-semibold">{paletteOf(look.palette).name}</span>{' '}
                    <span className="font-mono text-xs text-muted">#{palettes.indexOf(look.palette) + 1}</span>
                  </span>
                  <span className="flex justify-end">
                    {inUse ? (
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">In use</span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => onUse(look)} aria-label={`Use ${lookName(look)}`}>Use this</Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className="flex flex-col gap-4">
          <Card tone="strong" className="flex flex-col gap-3">
            <p className="eyebrow text-muted">In use now</p>
            <LookPreview look={current} />
            <p className="text-[13.5px] text-muted">
              {lookName(current)}. Saved on this device, so the landing page and the app open in it next time. Light and dark mode
              still follow your setting.
            </p>
            {currentId !== lookId(DEFAULT_LOOK) ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => onUse(DEFAULT_LOOK)}>
                Go back to the default look
              </Button>
            ) : null}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="small-title">Now do it for real</h2>
            <p className="text-[13.5px] text-muted">
              You just ranked, compared and got an ordered list. Pairwise does the same with your programs and your partner’s.
            </p>
            <Link href={signedIn ? '/app' : '/login'} className={buttonVariants({ className: 'self-start' })}>
              {signedIn ? 'Back to your lists' : 'Start your Match list'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
