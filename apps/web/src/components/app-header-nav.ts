import type { PageBreadcrumbItem } from "@/components/page-breadcrumb";

const TOP_LEVEL = new Set([
  "/",
  "/factors",
  "/datasources",
  "/test-sets",
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
  if (pathname === "/datasources/new") {
    return [{ href: "/datasources", label: "数据源" }, { label: "新增" }];
  }

  const dsEdit = /^\/datasources\/([^/]+)\/edit$/.exec(pathname);
  if (dsEdit) {
    const did = dsEdit[1];
    const base = `/datasources/${encodeURIComponent(did)}`;
    return [
      { href: "/datasources", label: "数据源" },
      { href: base, label: "数据源详情" },
      { label: "编辑" },
    ];
  }

  const dsDetail = /^\/datasources\/([^/]+)$/.exec(pathname);
  if (dsDetail && dsDetail[1] !== "new") {
    return [{ href: "/datasources", label: "数据源" }, { label: "数据源详情" }];
  }

  if (pathname === "/test-sets") return [{ label: "测试集" }];
  if (pathname === "/test-sets/new") {
    return [{ href: "/test-sets", label: "测试集" }, { label: "新增" }];
  }

  const tsEdit = /^\/test-sets\/([^/]+)\/edit$/.exec(pathname);
  if (tsEdit) {
    const tid = tsEdit[1];
    const base = `/test-sets/${encodeURIComponent(tid)}`;
    return [
      { href: "/test-sets", label: "测试集" },
      { href: base, label: "测试集详情" },
      { label: "编辑" },
    ];
  }

  const tsDetail = /^\/test-sets\/([^/]+)$/.exec(pathname);
  if (tsDetail && tsDetail[1] !== "new") {
    return [{ href: "/test-sets", label: "测试集" }, { label: "测试集详情" }];
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

  if (pathname === "/datasources/new") return "/datasources";

  const dsEdit = /^\/datasources\/([^/]+)\/edit$/.exec(pathname);
  if (dsEdit) return `/datasources/${encodeURIComponent(dsEdit[1])}`;

  const dsDetail = /^\/datasources\/([^/]+)$/.exec(pathname);
  if (dsDetail && dsDetail[1] !== "new") return "/datasources";

  if (pathname === "/test-sets/new") return "/test-sets";

  const tsEdit = /^\/test-sets\/([^/]+)\/edit$/.exec(pathname);
  if (tsEdit) return `/test-sets/${encodeURIComponent(tsEdit[1])}`;

  const tsDetail = /^\/test-sets\/([^/]+)$/.exec(pathname);
  if (tsDetail && tsDetail[1] !== "new") return "/test-sets";

  if (pathname.startsWith("/strategies/")) return "/strategies";
  if (pathname.startsWith("/backtest/")) return "/backtest";
  if (pathname.startsWith("/agent/")) return "/agent";

  return null;
}
