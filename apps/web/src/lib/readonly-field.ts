import { cn } from '@/lib/utils';

/**
 * 非 `<input>` 的只读展示块（业务里自定义布局用）。
 * 与 `app/globals.css` 中 `@layer components` 的只读字段主题一致。
 */
export const READONLY_CONTROL_SURFACE =
  'rounded-md border-0 bg-muted/30 px-3 py-2 text-sm text-foreground shadow-none dark:bg-muted/30';

export const READONLY_VALUE_MONO_CLASSNAME = cn(READONLY_CONTROL_SURFACE, 'font-mono md:text-sm');

export const READONLY_VALUE_MULTILINE_CLASSNAME = cn(READONLY_CONTROL_SURFACE, 'min-h-16 whitespace-pre-wrap');
