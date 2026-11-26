import type { Metadata, Viewport } from 'next';
import { Albert_Sans, Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans, Inter, Karla, Space_Grotesk, Unbounded, Young_Serif } from 'next/font/google';
import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { SiteFooter } from '@/components/site-footer';
import { themeScript } from '@/components/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { lookScript } from '@/lib/looks';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], display: 'swap', variable: '--font-space-grotesk' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-plex-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-plex-mono' });
// The other looks' fonts (lib/looks.ts). Not preloaded: they download only when a look uses them.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-bricolage' });
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-inter' });
const youngSerif = Young_Serif({ subsets: ['latin'], weight: '400', display: 'swap', preload: false, variable: '--font-young-serif' });
const karla = Karla({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-karla' });
const unbounded = Unbounded({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-unbounded' });
const albertSans = Albert_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-albert-sans' });
const fontVars = [display, sans, mono, bricolage, inter, youngSerif, karla, unbounded, albertSans].map((f) => f.variable).join(' ');

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#141612' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: lookScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <div className="backdrop" aria-hidden>
          <i className="b1" />
          <i className="b2" />
          <i className="b3" />
        </div>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>
        <ToastProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
