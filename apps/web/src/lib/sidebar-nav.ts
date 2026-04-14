import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Database,
  GitBranch,
  Layers,
  Library,
  LineChart,
  Settings,
  Table2,
  TableProperties,
  MessageCircle,
  Workflow,
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
    {
      title: "对话",
      url: "/",
      icon: MessageCircle,
      items: [{ title: "已归档会话", url: "/chat/archived", icon: Archive }],
    },
    {
      title: "因子",
      url: "/factors",
      icon: Layers,
      items: [
        { title: "因子库", url: "/factors/library", icon: Library },
        { title: "评价方案", url: "/factors/profiles", icon: Table2 },
      ],
    },
    {
      title: "节点",
      url: "/nodes",
      icon: Workflow,
      items: [],
    },
    {
      title: "数据",
      url: "/data",
      icon: TableProperties,
      items: [
        { title: "数据源", url: "/data/datasources", icon: Database },
        { title: "数据集", url: "/data/data-sets", icon: Table2 },
      ],
    },
    { title: "策略", url: "/strategies", icon: GitBranch },
    { title: "回测", url: "/backtest", icon: LineChart },
    {
      title: "配置",
      url: "/config",
      icon: Settings,
      items: [],
    },
  ],
};
