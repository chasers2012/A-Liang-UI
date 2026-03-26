import type { PageBreadcrumbItem } from "@/components/page-breadcrumb";

const TOP_LEVEL = new Set([
  "/",
  "/factors",
  "/datasources",
  "/strategies",
  "/backtest",
  "/agent",
]);

export function isTopLevelPath(pathname: string): boolean {
  return TOP_LEVEL.has(pathname);
}

/** 主内容顶栏面包屑 */
export function buildAppHeaderBreadcrumbs(
  pathname: string,
): PageBreadcrumbItem[] {
  if (pathname === "/") return [{ label: "首页" }];
  if (pathname === "/factors") return [{ label: "因子库" }];
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

  if (pathname === "/datasources") return [{ label: "数据源" }];
  if (pathname.startsWith("/datasources/")) {
    return [{ href: "/datasources", label: "数据源" }, { label: "详情" }];
  }

  if (pathname === "/strategies") return [{ label: "策略" }];
  if (pathname.startsWith("/strategies/")) {
    return [{ href: "/strategies", label: "策略" }, { label: "详情" }];
  }

  if (pathname === "/backtest") return [{ label: "回测" }];
  if (pathname.startsWith("/backtest/")) {
    return [{ href: "/backtest", label: "回测" }, { label: "详情" }];
  }

  if (pathname === "/agent") return [{ label: "Agent" }];
  if (pathname.startsWith("/agent/")) {
    return [{ href: "/agent", label: "Agent" }, { label: "详情" }];
  }

  return [{ label: "页面" }];
}

/** 非顶层时提供返回上一级 href；顶层为 null */
export function headerBackHref(pathname: string): string | null {
  if (isTopLevelPath(pathname)) return null;

  if (pathname === "/factors/new") return "/factors";

  const edit = /^\/factors\/([^/]+)\/edit$/.exec(pathname);
  if (edit) return `/factors/${encodeURIComponent(edit[1])}`;

  const hist = /^\/factors\/([^/]+)\/history$/.exec(pathname);
  if (hist) return `/factors/${encodeURIComponent(hist[1])}`;

  const detail = /^\/factors\/([^/]+)$/.exec(pathname);
  if (detail) return "/factors";

  if (pathname.startsWith("/datasources/")) return "/datasources";
  if (pathname.startsWith("/strategies/")) return "/strategies";
  if (pathname.startsWith("/backtest/")) return "/backtest";
  if (pathname.startsWith("/agent/")) return "/agent";

  return null;
}
