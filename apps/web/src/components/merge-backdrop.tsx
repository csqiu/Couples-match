'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BEATS, frame, geometry, STILL_STEP, type RowFrame } from '@/lib/merge-animation';

const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';

/**
 * The landing and sign-in background: a sage-to-plum wash with drifting glows, and two
 * lists merging into one list of pairs (lib/merge-animation.ts). Decorative only. With
 * reduced motion it holds one still frame and the glows stay put (globals.css).
 */
export function MergeBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1440, h: 900 });
  const [step, setStep] = useState(STILL_STEP);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width && height) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (still) {
      setStep(STILL_STEP);
      return;
    }
    let s = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(() => {
        s = (s + 1) % BEATS.length;
        setStep(s);
        tick();
      }, BEATS[s]);
    };
    setStep(0);
    tick();
    return () => clearTimeout(timer);
  }, [still]);

  const g = geometry(size.w, size.h);
  const f = frame(step, g);
  const half = g.pw / 2;
  const move = (r: RowFrame, dur: number, fade: number): CSSProperties => ({
    transform: `translate(${r.x}px, ${r.y}px)${r.sx !== 1 || r.sy !== 1 ? ` scale(${r.sx.toFixed(3)}, ${r.sy.toFixed(3)})` : ''}`,
    opacity: r.visible ? 1 : 0,
    transition: still ? 'none' : `transform ${dur}ms ${EASE}, opacity ${fade}ms ease`,
    willChange: 'transform, opacity',
  });
  const bar = (row: number, of: number, base: number, spread: number) => Math.round(of * (base + ((row * 7) % 5) * spread));

  return (
    <div ref={ref} aria-hidden className="hero-backdrop">
      <i className="hero-blob h1" />
      <i className="hero-blob h2" />
      <i className="hero-blob h3" />
      <i className="hero-blob h4" />
      <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="absolute inset-0 font-mono">
        {f.links.map((l, i) => {
          const x1 = g.lx + g.sw;
          const x2 = g.rx;
          const c = (x2 - x1) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${l.y1} C ${x1 + c} ${l.y1}, ${x2 - c} ${l.y2}, ${x2} ${l.y2}`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={2}
              style={{ opacity: f.linksOn ? 0.5 : 0, transition: still ? 'none' : `opacity ${f.linksOn ? 260 : 200}ms ease` }}
            />
          );
        })}

        {f.pairs.map((p, id) => (
          <g key={id} style={move(p, step >= 11 ? 760 : 700, step === 8 ? 200 : step >= 17 ? 600 : 280)}>
            <rect width={half} height={g.ph} rx={g.radius} fill="var(--hero-row-1)" stroke="var(--hero-edge-1)" />
            <rect x={half} width={half} height={g.ph} rx={g.radius} fill="var(--hero-row-2)" stroke="var(--hero-edge-2)" />
            <text x={g.ph * 0.5} y={g.ph / 2 + g.font * 0.36} textAnchor="middle" fontSize={g.font} fontWeight={600} fill="var(--plum-deep)">
              {p.n}
            </text>
            <rect x={g.ph} y={g.ph / 2 - 3} width={bar(p.left, half, 0.4, 0.06)} height={6} rx={3} fill="var(--blob-1)" />
            <rect x={half + g.ph * 0.5} y={g.ph / 2 - 3} width={bar(p.right, half, 0.42, 0.05)} height={6} rx={3} fill="var(--blob-2)" />
            <circle cx={half} cy={g.ph / 2} r={g.font > 11 ? 4 : 3} fill="var(--action)" />
          </g>
        ))}

        {f.singles.map((list, side) =>
          list.map((r, i) => (
            <g key={`${side}-${i}`} style={move(r, step >= 7 ? 760 : 420, step === 8 ? 240 : 300)}>
              <rect width={g.sw} height={g.sh} rx={g.radius} fill={`var(--hero-row-${side + 1})`} stroke={`var(--hero-edge-${side + 1})`} />
              <text
                x={g.sh * 0.45}
                y={g.sh / 2 + g.font * 0.36}
                textAnchor="middle"
                fontSize={g.font}
                fontWeight={600}
                fill={side === 0 ? 'var(--accent)' : 'var(--plum-deep)'}
              >
                {r.n}
              </text>
              <rect x={g.sh * 0.9} y={g.sh / 2 - 3} width={bar(i, g.sw, 0.35, 0.07)} height={6} rx={3} fill={`var(--blob-${side + 1})`} />
            </g>
          )),
        )}
      </svg>
    </div>
  );
}
