"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FactorSummaryPublic } from "@/lib/quant-agent-api";

type Props = {
  items: FactorSummaryPublic[];
  onDelete: (f: FactorSummaryPublic) => void;
};

function formatUpdatedAt(iso: string): string {
  return iso.replace("T", " ").replace("+00:00", " UTC");
}

export function FactorCardList({ items, onDelete }: Props) {
  return (
    <ul className="flex flex-col gap-2.5" role="list">
      {items.map((f) => {
        const depsText = f.dependencies.join(", ");
        return (
          <li key={f.id}>
            <Card
              size="sm"
              className="gap-0 py-0 shadow-sm ring-1 ring-border/80 transition-colors hover:bg-muted/20"
            >
              <CardHeader className="border-0 px-3 py-3 pb-2">
                <CardTitle className="truncate font-mono text-sm font-semibold tracking-tight">
                  {f.name}
                </CardTitle>
                <CardAction>
                  <div className="flex gap-0.5">
                    <Link
                      href={`/factors/${encodeURIComponent(f.id)}/edit`}
                      title="编辑"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-8",
                      )}
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      title="删除"
                      onClick={() => onDelete(f)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardAction>
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
              <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
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
          </li>
        );
      })}
    </ul>
  );
}
