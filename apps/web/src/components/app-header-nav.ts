import type { PageBreadcrumbItem } from "@/components/page-breadcrumb";

const TOP_LEVEL = new Set([
  "/",
  "/factors",
  "/evaluation-metrics",
  "/evaluation-profiles",
  "/datasources",
  "/test-sets",
  "/strategies",
  "/backtest",
  "/agent",
]);

/** Exact pathname → single crumb (list/home pages). */
const EXACT_HEADER_CRUMBS: Record<string, PageBreadcrumbItem[]> = {
  "/": [{ label: "首页" }],
  "/factors": [{ label: "因子库" }],
  "/evaluation-metrics": [{ label: "评价指标" }],
  "/evaluation-profiles": [{ label: "评价方案" }],
  "/datasources": [{ label: "数据源" }],
  "/test-sets": [{ label: "测试集" }],
  "/strategies": [{ label: "策略" }],
  "/backtest": [{ label: "回测" }],
  "/agent": [{ label: "Agent" }],
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function factorsHeaderBreadcrumbs(pathname: string): PageBreadcrumbItem[] | null {
  if (pathname === "/factors/new") {
    return [{ href: "/factors", label: "因子库" }, { label: "新增" }];
  }

  const edit = /^\/factors\/([^/]+)\/edit$/.exec(pathname);
  if (edit) {
    const id = edit[1];
    const base = `/factors/${encodeURIComponent(id)}`;
    return [
      { href: "/factors", label: "因子库" },
      { href: base, label: "因子详情" },
      { label: "编辑" },
    ];
  }

  const hist = /^\/factors\/([^/]+)\/history$/.exec(pathname);
  if (hist) {
    const id = hist[1];
    const base = `/factors/${encodeURIComponent(id)}`;
    return [
      { href: "/factors", label: "因子库" },
      { href: base, label: "因子详情" },
      { label: "历史版本" },
    ];
  }

  const detail = /^\/factors\/([^/]+)$/.exec(pathname);
  if (detail) {
    return [{ href: "/factors", label: "因子库" }, { label: "因子详情" }];
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

function factorsBackHref(pathname: string): string | null {
  if (pathname === "/factors/new") return "/factors";

  const edit = /^\/factors\/([^/]+)\/edit$/.exec(pathname);
  if (edit) return `/factors/${encodeURIComponent(edit[1])}`;

  const hist = /^\/factors\/([^/]+)\/history$/.exec(pathname);
  if (hist) return `/factors/${encodeURIComponent(hist[1])}`;

  const detail = /^\/factors\/([^/]+)$/.exec(pathname);
  if (detail) return "/factors";

  return null;
}

function standardResourceBackHref(pathname: string, listPath: string): string | null {
  const prefix = escapeRegExp(listPath);

  if (pathname === `${listPath}/new`) return listPath;

  const edit = new RegExp(`^${prefix}/([^/]+)/edit$`).exec(pathname);
  if (edit) return `${listPath}/${encodeURIComponent(edit[1])}`;

  const detail = new RegExp(`^${prefix}/([^/]+)$`).exec(pathname);
  if (detail && detail[1] !== "new") return listPath;

  return null;
}

function prefixSectionBackHref(pathname: string, basePath: string): string | null {
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
  if (exact) return exact;

  const factors = factorsHeaderBreadcrumbs(pathname);
  if (factors) return factors;

  const metrics = standardResourceBreadcrumbs(
    pathname,
    "/evaluation-metrics",
    "评价指标",
    "详情",
  );
  if (metrics) return metrics;

  const profiles = standardResourceBreadcrumbs(
    pathname,
    "/evaluation-profiles",
    "评价方案",
    "详情",
  );
  if (profiles) return profiles;

  const datasources = standardResourceBreadcrumbs(
    pathname,
    "/datasources",
    "数据源",
    "数据源详情",
  );
  if (datasources) return datasources;

  const testSets = standardResourceBreadcrumbs(
    pathname,
    "/test-sets",
    "测试集",
    "测试集详情",
  );
  if (testSets) return testSets;

  const strategies = prefixSectionBreadcrumbs(pathname, "/strategies", "策略");
  if (strategies) return strategies;

  const backtest = prefixSectionBreadcrumbs(pathname, "/backtest", "回测");
  if (backtest) return backtest;

  const agent = prefixSectionBreadcrumbs(pathname, "/agent", "Agent");
  if (agent) return agent;

  return [{ label: "页面" }];
}

/** 非顶层时提供返回上一级 href；顶层为 null */
export function headerBackHref(pathname: string): string | null {
  if (isTopLevelPath(pathname)) return null;

  const factors = factorsBackHref(pathname);
  if (factors !== null) return factors;

  const metrics = standardResourceBackHref(pathname, "/evaluation-metrics");
  if (metrics !== null) return metrics;

  const profiles = standardResourceBackHref(pathname, "/evaluation-profiles");
  if (profiles !== null) return profiles;

  const datasources = standardResourceBackHref(pathname, "/datasources");
  if (datasources !== null) return datasources;

  const testSets = standardResourceBackHref(pathname, "/test-sets");
  if (testSets !== null) return testSets;

  const strategies = prefixSectionBackHref(pathname, "/strategies");
  if (strategies !== null) return strategies;

  const backtest = prefixSectionBackHref(pathname, "/backtest");
  if (backtest !== null) return backtest;

  const agent = prefixSectionBackHref(pathname, "/agent");
  if (agent !== null) return agent;

  return null;
}
