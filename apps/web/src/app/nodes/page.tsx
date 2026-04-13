"use client";

import { useContext } from "react";

import { NodesBrowseSelectionContext } from "./layout";
import { NodesNodeDetailPanel } from "./components/panel/node-detail-panel";

/** `/nodes`：右侧为预览 + 源码；选中项由 layout 列表与 Context 决定（无 URL id 时默认筛选结果首项）。 */
export default function NodesPage() {
  const effectiveSelectedId = useContext(NodesBrowseSelectionContext);
  return <NodesNodeDetailPanel nodeId={effectiveSelectedId} />;
}
