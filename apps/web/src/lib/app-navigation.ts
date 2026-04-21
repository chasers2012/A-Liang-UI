import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BookOpen,
  Database,
  GitBranch,
  Layers,
  Library,
  LineChart,
  ListChecks,
  MessageCircle,
  Settings,
  Table2,
  TableProperties,
  Workflow,
  Wrench,
} from 'lucide-react';

export type SidebarNavLeaf = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type SidebarNavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: SidebarNavLeaf[];
};

export const SIDEBAR_NAV: SidebarNavMainItem[] = [
  {
    title: '对话',
    url: '/',
    icon: MessageCircle,
    items: [{ title: '已归档会话', url: '/chat/archived', icon: Archive }],
  },
  {
    title: '数据',
    url: '/data',
    icon: TableProperties,
    items: [
      { title: '数据源', url: '/data/datasources', icon: Database },
      { title: '数据集', url: '/data/data-sets', icon: Table2 },
    ],
  },
  {
    title: '因子',
    url: '/factors',
    icon: Layers,
    items: [
      { title: '因子库', url: '/factors/library', icon: Library },
      { title: '评价方案', url: '/factors/profiles', icon: Table2 },
    ],
  },
  { title: '策略', url: '/strategies', icon: GitBranch },
  { title: '回测', url: '/backtest', icon: LineChart },
  { title: '任务', url: '/scheduler', icon: ListChecks },
  { title: '知识库', url: '/knowledge', icon: BookOpen },
  { title: '节点', url: '/nodes', icon: Workflow },
  { title: '工具', url: '/tools', icon: Wrench },
  { title: '配置', url: '/config', icon: Settings },
];
