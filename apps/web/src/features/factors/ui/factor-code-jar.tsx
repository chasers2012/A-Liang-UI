"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type CodeJarApi = {
  updateCode: (code: string, callOnUpdate?: boolean) => void;
  onUpdate: (callback: (code: string) => void) => void;
  destroy: () => void;
  toString: () => string;
};

type Props = {
  id: string;
  value: string;
  onChange: (code: string) => void;
  className?: string;
};

async function loadCodeJarWithPythonHighlight(): Promise<{
  CodeJar: typeof import("codejar").CodeJar;
  highlight: (editor: HTMLElement) => void;
}> {
  const [{ CodeJar }, Prism] = await Promise.all([
    import("codejar"),
    import("prismjs"),
  ]);
  await import("prismjs/components/prism-python");

  const grammar = Prism.default.languages.python;
  const highlight = (editor: HTMLElement) => {
    const code = editor.textContent ?? "";
    if (!code) {
      editor.innerHTML = "";
      return;
    }
    if (!grammar) {
      return;
    }
    editor.innerHTML = Prism.default.highlight(code, grammar, "python");
  };

  return { CodeJar, highlight };
}

/**
 * CodeJar + Prism Python highlighting. Dynamic imports keep `window`-using
 * deps off the SSR graph.
 */
export function FactorCodeJar({ id, value, onChange, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const jarRef = useRef<CodeJarApi | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const mountGenRef = useRef(0);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = value;
  });

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const gen = ++mountGenRef.current;
    let jarLocal: CodeJarApi | null = null;
    let cancelled = false;

    void loadCodeJarWithPythonHighlight().then(({ CodeJar, highlight }) => {
      if (gen !== mountGenRef.current || !elRef.current) return;
      const j = CodeJar(elRef.current, highlight, {
        tab: "  ",
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
    });

    return () => {
      cancelled = true;
      jarLocal?.destroy();
      jarRef.current = null;
    };
  }, []);

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
      aria-label="Python 源码"
      className={cn(
        "factor-code-jar-editor",
        "min-h-[min(50vh,28rem)] w-full overflow-auto rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs leading-relaxed shadow-xs transition-[color,box-shadow] outline-none sm:min-h-88",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "dark:bg-input/30",
        className,
      )}
    />
  );
}
