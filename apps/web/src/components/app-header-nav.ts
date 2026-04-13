import type { PageBreadcrumbItem } from "@/components/page-breadcrumb";

const FACTOR_ROOT_HREF = "/factors";
const DATA_ROOT_HREF = "/data";

const FACTOR_LIBRARY_LIST = "/factors/library";
const FACTOR_PROFILES_LIST = "/factors/profiles";
const FACTOR_METRICS_LIST = "/factors/metrics";
const DATA_DATASOURCES_LIST = "/data/datasources";
const DATA_DATA_SETS_LIST = "/data/data-sets";
const NODES_LIST = "/nodes";

const TOP_LEVEL = new Set([
  "/",
  FACTOR_ROOT_HREF,
  FACTOR_LIBRARY_LIST,
  FACTOR_PROFILES_LIST,
  FACTOR_METRICS_LIST,
  DATA_ROOT_HREF,
  DATA_DATASOURCES_LIST,
  DATA_DATA_SETS_LIST,
  "/strategies",
  "/backtest",
  "/agent",
  NODES_LIST,
]);

/** Exact pathname → single crumb (list/home pages). */
const EXACT_HEADER_CRUMBS: Record<string, PageBreadcrumbItem[]> = {
  "/": [{ label: "对话" }],
  [FACTOR_ROOT_HREF]: [{ label: "因子" }],
  [FACTOR_LIBRARY_LIST]: [{ label: "因子库" }],
  [FACTOR_PROFILES_LIST]: [{ label: "评价方案" }],
  [FACTOR_METRICS_LIST]: [{ label: "节点" }],
  [DATA_ROOT_HREF]: [{ label: "数据" }],
  [DATA_DATASOURCES_LIST]: [{ label: "数据源" }],
  [DATA_DATA_SETS_LIST]: [{ label: "数据集" }],
  "/strategies": [{ label: "策略" }],
  "/backtest": [{ label: "回测" }],
  "/agent": [{ label: "Agent" }],
  [NODES_LIST]: [{ label: "节点" }],
};

function withMenuSection(
  pathname: string,
  items: PageBreadcrumbItem[],
): PageBreadcrumbItem[] {
  if (pathname === FACTOR_ROOT_HREF || pathname === DATA_ROOT_HREF) {
    return items;
  }

  if (
    items[0]?.href === FACTOR_ROOT_HREF ||
    items[0]?.href === DATA_ROOT_HREF
  ) {
    return items;
  }

  const factorChild = pathname.startsWith("/factors/");

  if (factorChild) {
    return [{ href: FACTOR_ROOT_HREF, label: "因子" }, ...items];
  }

  const dataChild = pathname.startsWith("/data/");

  if (dataChild) {
    return [{ href: DATA_ROOT_HREF, label: "数据" }, ...items];
  }

  return items;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function factorsLibraryHeaderBreadcrumbs(
  pathname: string,
): PageBreadcrumbItem[] | null {
  if (pathname === `${FACTOR_LIBRARY_LIST}/new`) {
    return [{ href: FACTOR_LIBRARY_LIST, label: "因子库" }, { label: "新增" }];
  }

  const edit = /^\/factors\/library\/([^/]+)\/edit$/.exec(pathname);
  if (edit) {
    const id = edit[1];
    const base = `/factors/library/${encodeURIComponent(id)}`;
    return [
      { href: FACTOR_LIBRARY_LIST, label: "因子库" },
      { href: base, label: "因子详情" },
      { label: "编辑" },
    ];
  }

  const detail = /^\/factors\/library\/([^/]+)$/.exec(pathname);
  if (detail) {
    return [
      { href: FACTOR_LIBRARY_LIST, label: "因子库" },
      { label: "因子详情" },
    ];
  }

  return null;
}

/** /list, /list/new, /list/:id, /list/:id/edit — detail label is middle + last segment text. */
function standardResourceBreadcrumbs(
  pathname: string,
  listPath: string,
  listLabel: string,
  detailLabel: string,
): PageBreadcrumbItem[] | null {
  const listCrumb = { href: listPath, label: listLabel };
  const prefix = escapeRegExp(listPath);

  if (pathname === `${listPath}/new`) {
    return [listCrumb, { label: "新增" }];
  }

  const edit = new RegExp(`^${prefix}/([^/]+)/edit$`).exec(pathname);
  if (edit) {
    const id = edit[1];
    const base = `${listPath}/${encodeURIComponent(id)}`;
    return [listCrumb, { href: base, label: detailLabel }, { label: "编辑" }];
  }

  const detail = new RegExp(`^${prefix}/([^/]+)$`).exec(pathname);
  if (detail && detail[1] !== "new") {
    return [listCrumb, { label: detailLabel }];
  }

  return null;
}

function prefixSectionBreadcrumbs(
  pathname: string,
  basePath: string,
  listLabel: string,
): PageBreadcrumbItem[] | null {
  if (pathname === basePath) return [{ label: listLabel }];
  if (pathname.startsWith(`${basePath}/`)) {
    return [{ href: basePath, label: listLabel }, { label: "详情" }];
  }
  return null;
}

function factorsLibraryBackHref(pathname: string): string | null {
  if (pathname === `${FACTOR_LIBRARY_LIST}/new`) return FACTOR_LIBRARY_LIST;

  const edit = /^\/factors\/library\/([^/]+)\/edit$/.exec(pathname);
  if (edit) return `/factors/library/${encodeURIComponent(edit[1])}`;

  const detail = /^\/factors\/library\/([^/]+)$/.exec(pathname);
  if (detail) return FACTOR_LIBRARY_LIST;

  return null;
}

function standardResourceBackHref(
  pathname: string,
  listPath: string,
): string | null {
  const prefix = escapeRegExp(listPath);

  if (pathname === `${listPath}/new`) return listPath;

  const edit = new RegExp(`^${prefix}/([^/]+)/edit$`).exec(pathname);
  if (edit) return `${listPath}/${encodeURIComponent(edit[1])}`;

  const detail = new RegExp(`^${prefix}/([^/]+)$`).exec(pathname);
  if (detail && detail[1] !== "new") return listPath;

  return null;
}

function prefixSectionBackHref(
  pathname: string,
  basePath: string,
): string | null {
  if (pathname.startsWith(`${basePath}/`)) return basePath;
  return null;
}

export function isTopLevelPath(pathname: string): boolean {
  return TOP_LEVEL.has(pathname);
}

/** 主内容顶栏面包屑 */
export function buildAppHeaderBreadcrumbs(
  pathname: string,
): PageBreadcrumbItem[] {
  const exact = EXACT_HEADER_CRUMBS[pathname];
  if (exact) return withMenuSection(pathname, exact);

  const factorsLib = factorsLibraryHeaderBreadcrumbs(pathname);
  if (factorsLib) return withMenuSection(pathname, factorsLib);

  const metrics = standardResourceBreadcrumbs(
    pathname,
    FACTOR_METRICS_LIST,
    "节点",
    "详情",
  );
  if (metrics) return withMenuSection(pathname, metrics);

  const nodes = standardResourceBreadcrumbs(pathname, NODES_LIST, "节点", "详情");
  if (nodes) return withMenuSection(pathname, nodes);

  const profiles = standardResourceBreadcrumbs(
    pathname,
    FACTOR_PROFILES_LIST,
    "评价方案",
    "详情",
  );
  if (profiles) return withMenuSection(pathname, profiles);

  const datasources = standardResourceBreadcrumbs(
    pathname,
    DATA_DATASOURCES_LIST,
    "数据源",
    "数据源详情",
  );
  if (datasources) return withMenuSection(pathname, datasources);

  const dataSetsCrumbs = standardResourceBreadcrumbs(
    pathname,
    DATA_DATA_SETS_LIST,
    "数据集",
    "数据集详情",
  );
  if (dataSetsCrumbs) return withMenuSection(pathname, dataSetsCrumbs);

  const strategies = prefixSectionBreadcrumbs(pathname, "/strategies", "策略");
  if (strategies) return withMenuSection(pathname, strategies);

  const backtest = prefixSectionBreadcrumbs(pathname, "/backtest", "回测");
  if (backtest) return withMenuSection(pathname, backtest);

  if (pathname === "/agent/config") {
    return withMenuSection(pathname, [
      { href: "/agent", label: "Agent" },
      { label: "配置" },
    ]);
  }

  if (pathname === "/chat/archived") {
    return withMenuSection(pathname, [
      { href: "/", label: "对话" },
      { label: "已归档会话" },
    ]);
  }

  const agent = prefixSectionBreadcrumbs(pathname, "/agent", "Agent");
  if (agent) return withMenuSection(pathname, agent);

  return withMenuSection(pathname, [{ label: "页面" }]);
}

/**
 * 是否应在顶栏显示「返回」：非 null 表示可显示（具体 URL 仅用于推导，实际为 history back）。
 */
export function headerBackHref(pathname: string): string | null {
  if (isTopLevelPath(pathname)) return null;

  const factorsLib = factorsLibraryBackHref(pathname);
  if (factorsLib !== null) return factorsLib;

  const metrics = standardResourceBackHref(pathname, FACTOR_METRICS_LIST);
  if (metrics !== null) return metrics;

  const nodesBack = standardResourceBackHref(pathname, NODES_LIST);
  if (nodesBack !== null) return nodesBack;

  const profiles = standardResourceBackHref(pathname, FACTOR_PROFILES_LIST);
  if (profiles !== null) return profiles;

  const datasources = standardResourceBackHref(pathname, DATA_DATASOURCES_LIST);
  if (datasources !== null) return datasources;

  const dataSetsBack = standardResourceBackHref(pathname, DATA_DATA_SETS_LIST);
  if (dataSetsBack !== null) return dataSetsBack;

  const strategies = prefixSectionBackHref(pathname, "/strategies");
  if (strategies !== null) return strategies;

  const backtest = prefixSectionBackHref(pathname, "/backtest");
  if (backtest !== null) return backtest;

  if (pathname === "/chat/archived") return "/";

  const agent = prefixSectionBackHref(pathname, "/agent");
  if (agent !== null) return agent;

  return null;
}
