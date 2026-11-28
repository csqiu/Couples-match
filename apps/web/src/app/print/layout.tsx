import type { ReactNode } from 'react';

/** Print pages: no backdrop and no glass, on screen as on paper. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="print-route">{children}</div>;
}
