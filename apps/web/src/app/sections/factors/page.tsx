import Link from "next/link";

import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { sidebarNav } from "@/lib/sidebar-nav";
import { cn } from "@/lib/utils";

export default function FactorSectionPage() {
  const group = sidebarNav.navMain.find((i) => i.title === "因子");
  if (!group?.items?.length) return null;

  return (
    <Page
      title="因子"
      description="与侧栏「因子」分组一致：因子库、评价方案与评价指标。"
      gap="sm"
    >
      <ul className="grid max-w-md gap-2">
        {group.items.map((leaf) => {
          const SubIcon = leaf.icon;
          return (
            <li key={leaf.url}>
              <Link
                href={leaf.url}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "flex w-full items-center justify-start gap-2 py-6",
                )}
              >
                <SubIcon className="size-4 shrink-0" aria-hidden />
                {leaf.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
