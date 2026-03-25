"use client";

import { useAtom } from "jotai";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { counterAtom } from "@/lib/atoms";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function HomeDemo() {
  const [count, setCount] = useAtom(counterAtom);
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/health`)
      .then((r) => r.json())
      .then((data: { status?: string }) => {
        if (!cancelled) setHealth(data.status ?? JSON.stringify(data));
      })
      .catch(() => {
        if (!cancelled) setHealth("unreachable (start apps/api)");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-xl border border-border bg-card p-8 text-card-foreground shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">shadcn + Jotai</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Local state with Jotai; API check uses{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            NEXT_PUBLIC_API_URL
          </code>
          .
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm tabular-nums">Count: {count}</span>
        <Button type="button" variant="outline" onClick={() => setCount((c) => c - 1)}>
          −
        </Button>
        <Button type="button" onClick={() => setCount((c) => c + 1)}>
          +
        </Button>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Backend </span>
        <code className="text-xs">GET /health</code>
        <span className="text-muted-foreground"> → </span>
        <span className="font-medium">{health ?? "…"}</span>
      </div>
    </div>
  );
}
