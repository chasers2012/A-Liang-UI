"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type PageBreadcrumbItem = {
  href?: string;
  label: string;
};

/** 通用面包屑；末项无 href 表示当前页 */
export function PageBreadcrumb({
  items,
  variant = "default",
}: {
  items: PageBreadcrumbItem[];
  /** header：顶栏用大号字号 */
  variant?: "default" | "header";
}) {
  if (items.length === 0) return null;
  const header = variant === "header";
  return (
    <nav aria-label="面包屑" className="min-w-0 flex-1 -ml-0.5">
      <ol
        className={cn(
          "flex flex-wrap items-center text-muted-foreground",
          header
            ? "gap-2 text-base md:text-lg leading-snug"
            : "gap-1 text-sm",
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${index}-${item.label}`}
              className="inline-flex max-w-full min-w-0 items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRight
                  className={cn(
                    "shrink-0 text-muted-foreground/50",
                    header ? "size-4 md:size-4.5" : "size-3.5",
                  )}
                  aria-hidden
                />
              ) : null}
              {item.href != null && item.href !== "" && !isLast ? (
                <Link
                  href={item.href}
                  className={cn(
                    "truncate rounded-md px-0.5 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    header && "font-medium",
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "truncate px-0.5 py-0.5",
                    isLast &&
                    cn(
                      "text-foreground",
                      header
                        ? "text-lg font-semibold md:text-xl"
                        : "font-medium",
                    ),
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
