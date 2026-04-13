"use client";

import { NodesNodeDetailPanel } from "../components/panel/node-detail-panel";

/** `/nodes/new`：与详情页完全同一套面板逻辑，通过空 nodeId 进入新建流程。 */
export default function NodeNewPage() {
  return <NodesNodeDetailPanel nodeId={null} />;
}
