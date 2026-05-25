import { hasFeatureFlag, PAGE_FEATURES, type PageFeature } from '@/lib/feature-flags';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  ArrowRightLeft,
  Bot,
  BookOpen,
  Database,
  GitBranch,
  Library,
  LineChart,
  ListChecks,
  MessageCircle,
  Settings,
  Settings2,
  Table2,
  TableProperties,
  Workflow,
  Wrench,
} from 'lucide-react';

export type NavLeaf = {
  title: string;
  url: string;
  icon: LucideIcon;
};

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  items?: NavLeaf[];
  /** 无独立落地页，点击主项仅展开子菜单 */
  menuOnly?: boolean;
};

/** Feature flag → nav/route URLs gated by that flag. */
export const FEATURE_FLAG_URLS: Record<PageFeature, readonly string[]> = {
  [PAGE_FEATURES.ENABLE_PROFILES]: ['/profiles'],
};

const gatedUrls = new Set(Object.values(FEATURE_FLAG_URLS).flat());

const enabledFeatureUrls = new Set(
  Object.entries(FEATURE_FLAG_URLS)
    .filter(([flag]) => hasFeatureFlag(flag))
    .flatMap(([, urls]) => urls),
);

export const APP_NAV: NavItem[] = [
  { title: '对话', url: '/', icon: MessageCircle },
  {
    title: '数据',
    url: '#',
    icon: TableProperties,
    menuOnly: true,
    items: [
      { title: '数据源', url: '/data/datasources', icon: Database },
      { title: '数据集', url: '/data/data-sets', icon: Table2 },
      { title: '数据同步', url: '/data/sync', icon: ArrowRightLeft },
    ],
  },
  { title: '评价方案', url: '/profiles', icon: Table2 },
  {
    title: '因子库',
    url: '/factors',
    icon: Library,
  },
  { title: '策略', url: '/strategies', icon: GitBranch },
  { title: '回测', url: '/backtest', icon: LineChart },
  { title: '知识库', url: '/knowledge', icon: BookOpen },
  { title: '节点', url: '/nodes', icon: Workflow },
  {
    title: '管理',
    url: '#',
    icon: Settings2,
    menuOnly: true,
    items: [
      { title: '会话管理', url: '/chat/archived', icon: Archive },
      { title: '任务', url: '/scheduler', icon: ListChecks },
      { title: '子代理', url: '/subagents', icon: Bot },
      { title: '工具', url: '/tools', icon: Wrench },
      { title: '配置', url: '/config', icon: Settings },
    ],
  },
];

export function isPathAccessible(pathname: string): boolean {
  for (const url of gatedUrls) {
    if (pathname !== url && !pathname.startsWith(`${url}/`)) continue;
    return enabledFeatureUrls.has(url);
  }
  return true;
}

export function getNav(): NavItem[] {
  return APP_NAV.filter((item) => !gatedUrls.has(item.url) || enabledFeatureUrls.has(item.url)).map((item) => {
    if (!item.items?.length) return item;
    const items = item.items.filter((leaf) => !gatedUrls.has(leaf.url) || enabledFeatureUrls.has(leaf.url));
    return { ...item, items };
  });
}
