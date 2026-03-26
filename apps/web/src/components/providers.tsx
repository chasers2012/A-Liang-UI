"use client";

import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="quant-agent-theme"
    >
      <Provider>{children}</Provider>
    </ThemeProvider>
  );
}
