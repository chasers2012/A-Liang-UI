import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Database,
  GitBranch,
  LayoutDashboard,
  Layers,
  Library,
  LineChart,
  Table2,
  TableProperties,
} from "lucide-react";

export type SidebarNavLeaf = {
  title: string;
  url: string;
  isActive?: boolean;
  icon: LucideIcon;
};

export type SidebarNavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SidebarNavLeaf[];
};

export const sidebarNav: { navMain: SidebarNavMainItem[] } = {
  navMain: [
    { title: "首页", url: "/", icon: LayoutDashboard },
    {
      title: "因子",
      url: "/sections/factors",
      icon: Layers,
      items: [
        { title: "因子库", url: "/factors", icon: Library },
        { title: "评价方案", url: "/evaluation-profiles", icon: Table2 },
        { title: "评价指标", url: "/evaluation-metrics", icon: LineChart },
      ],
    },
    {
      title: "数据",
      url: "/sections/data",
      icon: TableProperties,
      items: [
        { title: "数据源", url: "/datasources", icon: Database },
        { title: "数据集", url: "/test-sets", icon: Table2 },
      ],
    },
    { title: "策略", url: "/strategies", icon: GitBranch },
    { title: "回测", url: "/backtest", icon: LineChart },
    { title: "Agent", url: "/agent", icon: Bot },
  ],
};
