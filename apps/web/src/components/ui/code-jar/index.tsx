'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

import './code-jar.css';

type CodeJarApi = {
  updateCode: (code: string, callOnUpdate?: boolean) => void;
  onUpdate: (callback: (code: string) => void) => void;
  destroy: () => void;
  toString: () => string;
};

export type CodeJarLanguage = 'python';

type CodeJarBaseProps = {
  id: string;
  value: string;
  className?: string;
  /** Prism grammar; more languages can be wired in `loadCodeJarWithHighlight`. */
  language?: CodeJarLanguage;
  'aria-label'?: string;
};

export type CodeJarProps = CodeJarBaseProps &
  (
    | {
        readOnly?: false;
        onChange: (code: string) => void;
      }
    | {
        readOnly: true;
        onChange?: undefined;
      }
  );

async function loadCodeJarWithHighlight(language: CodeJarLanguage): Promise<{
  CodeJar: typeof import('codejar').CodeJar;
  highlight: (editor: HTMLElement) => void;
}> {
  const [{ CodeJar }, Prism] = await Promise.all([import('codejar'), import('prismjs')]);

  if (language === 'python') {
    await import('prismjs/components/prism-python');
    const grammar = Prism.default.languages.python;
    const highlight = (editor: HTMLElement) => {
      const code = editor.textContent ?? '';
      if (!code) {
        editor.innerHTML = '';
        return;
      }
      if (!grammar) {
        return;
      }
      editor.innerHTML = Prism.default.highlight(code, grammar, 'python');
    };
    return { CodeJar, highlight };
  }

  const _exhaustive: never = language;
  throw new Error(`Unsupported CodeJar language: ${_exhaustive}`);
}

/**
 * CodeJar + Prism highlighting. Dynamic imports keep `window`-using deps off
 * the SSR graph.
 */
export function CodeJar(props: CodeJarProps) {
  const { id, value, className, language = 'python', 'aria-label': ariaLabelProp, readOnly = false } = props;
  const onChange: (code: string) => void = props.readOnly === true ? () => {} : props.onChange;
  const ariaLabel = ariaLabelProp ?? (language === 'python' ? 'Python 源码' : 'Code editor');
  const elRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<CodeJarApi | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const mountGenRef = useRef(0);
  const languageRef = useRef(language);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
    languageRef.current = language;
  });

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const gen = ++mountGenRef.current;
    const lang = languageRef.current;
    let jarLocal: CodeJarApi | null = null;
    let cancelled = false;

    void loadCodeJarWithHighlight(lang).then(({ CodeJar, highlight }) => {
      if (gen !== mountGenRef.current || !elRef.current) return;
      const j = CodeJar(elRef.current, highlight, {
        tab: '  ',
        spellcheck: false,
      });
      if (cancelled) {
        j.destroy();
        return;
      }
      jarLocal = j;
      jarRef.current = j;
      j.updateCode(valueRef.current, false);
      j.onUpdate((code) => {
        onChangeRef.current(code);
      });
      if (readOnly && elRef.current) {
        elRef.current.setAttribute('contenteditable', 'false');
      }
    });

    return () => {
      cancelled = true;
      jarLocal?.destroy();
      jarRef.current = null;
    };
  }, [language, readOnly]);

  useEffect(() => {
    const jar = jarRef.current;
    if (!jar) return;
    if (jar.toString() === value) return;
    jar.updateCode(value, false);
  }, [value]);

  return (
    <div
      ref={elRef}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-readonly={readOnly || undefined}
      aria-label={ariaLabel}
      className={cn(
        'code-jar-editor',
        'min-h-[min(50vh,28rem)] w-full overflow-auto rounded-md border border-input px-3 py-2 font-mono text-xs leading-relaxed shadow-xs transition-[color,box-shadow] outline-none sm:min-h-88',
        readOnly
          ? 'cursor-default bg-muted/30 focus-visible:border-input focus-visible:ring-0 dark:bg-muted/20'
          : 'bg-transparent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
        className,
      )}
    />
  );
}
