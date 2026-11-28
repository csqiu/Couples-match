'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Mode = 'system' | 'light' | 'dark';
const KEY = 'pairwise-theme';

export const themeScript = `(() => { try {
  const m = localStorage.getItem('${KEY}') || 'system';
  const dark = m === 'dark' || (m === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch {} })();`;

function apply(mode: Mode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new Event('pairwise-theme'));
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');
  useEffect(() => {
    try {
      setMode((localStorage.getItem(KEY) as Mode) || 'system');
    } catch {}
  }, []);
  const next: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[14px] border border-transparent text-muted transition-colors duration-150 hover:border-glass-border hover:bg-glass hover:text-text"
      aria-label={`Theme: ${mode}. Switch to ${next[mode]}.`}
      onClick={() => {
        const m = next[mode];
        setMode(m);
        try {
          localStorage.setItem(KEY, m);
        } catch {}
        apply(m);
      }}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}
