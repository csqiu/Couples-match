import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BRAND } from '@/brand';
import { SiteFooter } from '@/components/site-footer';
import { themeScript } from '@/components/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#121412' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <ToastProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
