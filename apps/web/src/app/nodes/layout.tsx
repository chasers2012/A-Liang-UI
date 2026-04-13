import type { ReactNode } from "react";

import { NodesLayoutClient } from "@/app/nodes/nodes-layout-client";

export default function NodesLayout({ children }: { children: ReactNode }) {
  return <NodesLayoutClient>{children}</NodesLayoutClient>;
}
