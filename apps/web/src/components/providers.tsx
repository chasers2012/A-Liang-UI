'use client';

import { IncremarkShadcnThemeProvider } from '@/components/incremark-shadcn-theme-provider';
import { MarkdownWarmup } from '@/components/markdown/markdown-warmup';
import { Provider } from 'jotai';
import { ThemeProvider } from 'next-themes';

import { TooltipProvider } from '@/components/ui/tooltip';
import { EventBusProvider } from '@/events';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="quant-agent-theme">
      <IncremarkShadcnThemeProvider>
        <TooltipProvider delay={200}>
          <Provider>
            <EventBusProvider>
              <div className="sr-only" aria-hidden="true">
                <MarkdownWarmup />
              </div>
              {children}
            </EventBusProvider>
          </Provider>
        </TooltipProvider>
      </IncremarkShadcnThemeProvider>
    </ThemeProvider>
  );
}
