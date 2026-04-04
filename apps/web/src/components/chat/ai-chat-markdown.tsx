"use client";

import {
  darkTheme as incremarkDarkTheme,
  defaultTheme as incremarkDefaultTheme,
  IncremarkContent,
  mergeTheme,
  ThemeProvider as IncremarkThemeProvider,
} from "@incremark/react";
import { memo } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

import "@incremark/theme/styles.css";

const SHADCN_THEME_LIGHT = mergeTheme(incremarkDefaultTheme, {
  color: {
    neutral: incremarkDefaultTheme.color.neutral,
    text: {
      primary: "var(--foreground)",
      secondary: "var(--muted-foreground)",
      tertiary: "var(--muted-foreground)",
      inverse: "var(--background)",
    },
    background: {
      base: "var(--background)",
      elevated: "var(--card)",
      overlay: "color-mix(in oklch, var(--background) 80%, black 20%)",
    },
    border: {
      subtle: "var(--border)",
      default: "var(--border)",
      strong: "var(--ring)",
    },
    brand: {
      ...incremarkDefaultTheme.color.brand,
      primary: "var(--primary)",
      primaryHover: "var(--primary)",
      primaryActive: "var(--primary)",
      primaryLight: "var(--accent)",
    },
    interactive: {
      link: "var(--primary)",
      linkHover: "var(--primary)",
      linkVisited: "var(--primary)",
      checked: "var(--primary)",
    },
    code: {
      inlineBackground: "var(--muted)",
      inlineText: "var(--foreground)",
      blockBackground: "var(--muted)",
      blockText: "var(--foreground)",
      headerBackground: "var(--card)",
    },
    status: {
      pending: "var(--muted-foreground)",
      completed: "var(--primary)",
    },
  },
  border: {
    radius: {
      sm: "calc(var(--radius) * 0.6)",
      md: "calc(var(--radius) * 0.8)",
      lg: "var(--radius)",
    },
  },
  typography: {
    ...incremarkDefaultTheme.typography,
    fontFamily: {
      base: "var(--font-sans)",
      mono: "var(--font-geist-mono)",
    },
  },
});

const SHADCN_THEME_DARK = mergeTheme(incremarkDarkTheme, {
  color: {
    neutral: incremarkDarkTheme.color.neutral,
    text: {
      primary: "var(--foreground)",
      secondary: "var(--muted-foreground)",
      tertiary: "var(--muted-foreground)",
      inverse: "var(--background)",
    },
    background: {
      base: "var(--background)",
      elevated: "var(--card)",
      overlay: "color-mix(in oklch, var(--background) 80%, black 20%)",
    },
    border: {
      subtle: "var(--border)",
      default: "var(--border)",
      strong: "var(--ring)",
    },
    brand: {
      ...incremarkDarkTheme.color.brand,
      primary: "var(--primary)",
      primaryHover: "var(--primary)",
      primaryActive: "var(--primary)",
      primaryLight: "var(--accent)",
    },
    interactive: {
      link: "var(--primary)",
      linkHover: "var(--primary)",
      linkVisited: "var(--primary)",
      checked: "var(--primary)",
    },
    code: {
      inlineBackground: "var(--muted)",
      inlineText: "var(--foreground)",
      blockBackground: "var(--muted)",
      blockText: "var(--foreground)",
      headerBackground: "var(--card)",
    },
    status: {
      pending: "var(--muted-foreground)",
      completed: "var(--primary)",
    },
  },
  border: {
    radius: {
      sm: "calc(var(--radius) * 0.6)",
      md: "calc(var(--radius) * 0.8)",
      lg: "var(--radius)",
    },
  },
  typography: {
    ...incremarkDarkTheme.typography,
    fontFamily: {
      base: "var(--font-sans)",
      mono: "var(--font-geist-mono)",
    },
  },
});

export const AiChatMarkdown = memo(function AiChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const shadcnTheme = resolvedTheme === "dark" ? SHADCN_THEME_DARK : SHADCN_THEME_LIGHT;

  return (
    <IncremarkThemeProvider theme={shadcnTheme}>
      <div className={cn("ai-chat-md wrap-break-word text-sm leading-relaxed", className)}>
        <IncremarkContent content={content} isFinished />
      </div>
    </IncremarkThemeProvider>
  );
});
