"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FactorSummaryPublic } from "@/lib/quant-agent-api";

type Props = {
  items: FactorSummaryPublic[];
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function FactorCardList({ items }: Props) {
  return (
    <ul className="flex flex-col gap-2.5" role="list">
      {items.map((f) => {
        const depsText = f.dependencies.join(", ");
        return (
          <li key={f.id}>
            <Link
              href={`/factors/library/${encodeURIComponent(f.id)}`}
              className={cn(
                "block rounded-xl outline-none ring-offset-background transition-colors",
                "hover:bg-muted/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <Card
                size="sm"
                className="py-0 transition-colors hover:bg-muted/20"
              >
                <CardHeader className="border-0 bg-transparent px-3 py-3 pb-2 shadow-none">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-tight">
                      {f.name}
                    </CardTitle>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground/60"
                      aria-hidden
                    />
                  </div>
                <CardDescription className="text-xs leading-relaxed">
                  <span className="text-muted-foreground">{f.group}</span>
                  {f.group_label && f.group_label !== f.group ? (
                    <span className="text-muted-foreground/70">
                      {" "}
                      · {f.group_label}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0 pb-3">
                {f.dependencies.length > 0 ? (
                  <p
                    className="line-clamp-2 font-mono text-[0.7rem] leading-snug text-muted-foreground"
                    title={depsText}
                  >
                    依赖 {depsText}
                  </p>
                ) : (
                  <p className="text-[0.7rem] text-muted-foreground/70">
                    无依赖
                  </p>
                )}
                <p className="text-[0.7rem] tabular-nums text-muted-foreground/80">
                  更新 {formatUpdatedAt(f.updated_at)}
                </p>
              </CardContent>
            </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
