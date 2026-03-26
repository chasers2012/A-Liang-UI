"use client";

import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="quant-agent-theme"
    >
      <Provider>{children}</Provider>
    </ThemeProvider>
  );
}
