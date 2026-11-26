import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Newsreader, Nunito_Sans, Outfit, Public_Sans, Space_Grotesk } from 'next/font/google';
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
const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-fraunces' });
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-public-sans' });
const outfit = Outfit({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-outfit' });
const nunitoSans = Nunito_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-nunito-sans' });
const newsreader = Newsreader({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-newsreader' });
const geist = Geist({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-geist-mono' });
const fontVars = [display, sans, mono, fraunces, publicSans, outfit, nunitoSans, newsreader, geist, geistMono].map((f) => f.variable).join(' ');

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
