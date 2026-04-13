"use client";

import { useParams } from "next/navigation";

import { NodesNodeDetailPanel } from "../components/panel/node-detail-panel";

/** `/nodes/[id]`：与首页同一套预览 + 源码面板，由 URL 指定节点。 */
export default function NodeDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  return <NodesNodeDetailPanel nodeId={id || null} />;
}
