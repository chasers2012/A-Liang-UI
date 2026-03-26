"use client";

import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="quant-agent-theme"
    >
      <TooltipProvider>
        <Provider>{children}</Provider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
