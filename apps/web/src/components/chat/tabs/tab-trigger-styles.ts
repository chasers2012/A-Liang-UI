import { cn } from "@/lib/utils";

export const chatSessionTabTriggerClassName = cn(
  "inline-flex max-w-64 items-center gap-2 truncate rounded-t-md border border-b-0 px-2.5 py-1 text-[0.82rem] transition-colors outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
  "aria-selected:border-primary/70 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm",
  "data-selected:border-primary/70 data-selected:bg-background data-selected:text-foreground data-selected:shadow-sm",
);
