'use client';

import { IncremarkShadcnThemeProvider } from '@/components/incremark-shadcn-theme-provider';
import { MarkdownWarmup } from '@/components/markdown/markdown-warmup';
import { Provider } from 'jotai';
import { ThemeProvider } from 'next-themes';

import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <IncremarkShadcnThemeProvider>
        <TooltipProvider delay={200}>
          <Provider>
            <div className="sr-only" aria-hidden="true">
              <MarkdownWarmup />
            </div>
            {children}
          </Provider>
        </TooltipProvider>
      </IncremarkShadcnThemeProvider>
    </ThemeProvider>
  );
}
