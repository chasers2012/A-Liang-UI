import Link from "next/link";

import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { sidebarNav } from "@/lib/sidebar-nav";
import { cn } from "@/lib/utils";

export default function DataSectionPage() {
  const group = sidebarNav.navMain.find((i) => i.title === "数据");
  if (!group?.items?.length) return null;

  return (
    <Page
      title="数据"
      description="与侧栏「数据」分组一致：数据源与数据集。"
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
