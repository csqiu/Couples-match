'use client';
import { useEffect, useState } from 'react';

/**
 * A date (and optionally time) in the viewer's own time zone. Formatting on the server would
 * use the server's zone (UTC on Vercel), so this fills in after hydration (bug log #26).
 */
export function LocalTime({ iso, time = false, className }: { iso: string; time?: boolean; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(
      new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) }),
    );
  }, [iso, time]);
  return (
    <time dateTime={iso} className={className}>
      {text ?? ' '}
    </time>
  );
}
