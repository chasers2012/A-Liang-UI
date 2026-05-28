'use client';

import {
  applyTheme,
  darkTheme as incremarkDarkTheme,
  defaultTheme as incremarkDefaultTheme,
  mergeTheme,
  ThemeProvider as IncremarkThemeProvider,
} from '@incremark/react';
import { useTheme } from 'next-themes';
import { memo, useLayoutEffect, useMemo, type ReactNode } from 'react';

const SHADCN_THEME_LIGHT = mergeTheme(incremarkDefaultTheme, {
  color: {
    neutral: incremarkDefaultTheme.color.neutral,
    text: {
      primary: 'var(--foreground)',
      secondary: 'var(--muted-foreground)',
      tertiary: 'var(--muted-foreground)',
      inverse: 'var(--background)',
    },
    background: {
      base: 'var(--background)',
      elevated: 'var(--card)',
      overlay: 'color-mix(in oklch, var(--background) 80%, black 20%)',
    },
    border: {
      subtle: 'var(--border)',
      default: 'var(--border)',
      strong: 'var(--ring)',
    },
    brand: {
      ...incremarkDefaultTheme.color.brand,
      primary: 'var(--primary)',
      primaryHover: 'var(--primary)',
      primaryActive: 'var(--primary)',
      primaryLight: 'var(--accent)',
    },
    interactive: {
      link: 'var(--primary)',
      linkHover: 'var(--primary)',
      linkVisited: 'var(--primary)',
      checked: 'var(--primary)',
    },
    code: {
      inlineBackground: 'var(--muted)',
      inlineText: 'var(--foreground)',
      blockBackground: 'var(--muted)',
      blockText: 'var(--foreground)',
      headerBackground: 'var(--card)',
    },
    status: {
      pending: 'var(--muted-foreground)',
      completed: 'var(--primary)',
    },
  },
  border: {
    radius: {
      sm: 'calc(var(--radius) * 0.6)',
      md: 'calc(var(--radius) * 0.8)',
      lg: 'var(--radius)',
    },
  },
  typography: {
    ...incremarkDefaultTheme.typography,
    fontFamily: {
      base: 'var(--font-sans)',
      mono: 'var(--font-geist-mono)',
    },
  },
});

const SHADCN_THEME_DARK = mergeTheme(incremarkDarkTheme, {
  color: {
    neutral: incremarkDarkTheme.color.neutral,
    text: {
      primary: 'var(--foreground)',
      secondary: 'var(--muted-foreground)',
      tertiary: 'var(--muted-foreground)',
      inverse: 'var(--background)',
    },
    background: {
      base: 'var(--background)',
      elevated: 'var(--card)',
      overlay: 'color-mix(in oklch, var(--background) 80%, black 20%)',
    },
    border: {
      subtle: 'var(--border)',
      default: 'var(--border)',
      strong: 'var(--ring)',
    },
    brand: {
      ...incremarkDarkTheme.color.brand,
      primary: 'var(--primary)',
      primaryHover: 'var(--primary)',
      primaryActive: 'var(--primary)',
      primaryLight: 'var(--accent)',
    },
    interactive: {
      link: 'var(--primary)',
      linkHover: 'var(--primary)',
      linkVisited: 'var(--primary)',
      checked: 'var(--primary)',
    },
    code: {
      inlineBackground: 'var(--muted)',
      inlineText: 'var(--foreground)',
      blockBackground: 'var(--muted)',
      blockText: 'var(--foreground)',
      headerBackground: 'var(--card)',
    },
    status: {
      pending: 'var(--muted-foreground)',
      completed: 'var(--primary)',
    },
  },
  border: {
    radius: {
      sm: 'calc(var(--radius) * 0.6)',
      md: 'calc(var(--radius) * 0.8)',
      lg: 'var(--radius)',
    },
  },
  typography: {
    ...incremarkDarkTheme.typography,
    fontFamily: {
      base: 'var(--font-sans)',
      mono: 'var(--font-geist-mono)',
    },
  },
});

/**
 * 将 Incremark（Markdown 等）主题与当前应用的 shadcn CSS 变量及 next-themes 明暗同步。
 * 必须作为 `next-themes` 的 ThemeProvider 的子组件使用。
 *
 * Incremark 的 ThemeProvider 只把变量写在自身 DOM 上；Tooltip/Dialog 等 Portal 挂在 body 下，
 * 不在该子树内，读不到合并后的 token。因此在 `document.documentElement` 上同步一份相同的
 * `--incremark-*`，保证全局（含 Portal）与此处配置一致。
 */
export const IncremarkShadcnThemeProvider = memo(function IncremarkShadcnThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const shadcnTheme = useMemo(
    () => (resolvedTheme === 'dark' ? SHADCN_THEME_DARK : SHADCN_THEME_LIGHT),
    [resolvedTheme],
  );

  useLayoutEffect(() => {
    applyTheme(document.documentElement, shadcnTheme);
  }, [shadcnTheme]);

  return (
    <IncremarkThemeProvider theme={shadcnTheme} className="contents">
      {children}
    </IncremarkThemeProvider>
  );
});
