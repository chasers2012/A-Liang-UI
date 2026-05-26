import type { Metadata } from 'next';
import { Geist, Geist_Mono, Public_Sans } from 'next/font/google';
import Script from 'next/script';

import { AppShell } from '@/components/app-shell';
import { Providers } from '@/components/providers';

import './globals.css';
import '@incremark/theme/styles.css';
import { cn } from '@/lib/utils';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'quant-agent',
  description: 'Next.js + Python monorepo',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'dark overflow-hidden h-full antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-sans',
        publicSans.variable,
      )}
    >
      <body className="overflow-hidden flex min-h-dvh flex-col h-screen w-screen">
        <Script src={`${process.env.NEXT_PUBLIC_WEB_BASE_PATH ?? ''}/config.js`} strategy="beforeInteractive" />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
