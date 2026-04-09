import { memo, useCallback, useEffect } from "react";
import {
  useStore,
  useUpdateNodeInternals,
} from "reactflow";

import { cn } from "@/lib/utils";

import type { WorkflowSocketDefinition } from "../../types";
import {
  appendableHandleBase,
  appendableHandleId,
  normalizeAppendableHandle,
} from "../appendable-handle";
import { SocketDescriptionTooltip } from "./socket-description-tooltip";
import { WorkflowHandle } from "./workflow-handle";

// eslint-disable-next-line complexity
function pickSourceValueTypeFromStore(s: unknown): string | null {
  const anyState = s as {
    connectionNodeId?: string | null;
    connectionHandleId?: string | null;
    connection?: {
      inProgress?: boolean;
      source?: string | null;
      sourceHandle?: string | null;
    } | null;
    getNodes?: () => Array<{ id: string; data?: unknown }>;
  };
  const isConnecting = Boolean(anyState.connectionNodeId) || Boolean(anyState.connection?.inProgress);
  if (!isConnecting) return null;
  if (!anyState.getNodes) return null;

  const sourceNodeId = (anyState.connection?.source ?? anyState.connectionNodeId) ?? null;
  const sourceHandleId =
    (anyState.connection?.sourceHandle ?? anyState.connectionHandleId) ?? null;
  if (!sourceNodeId || !sourceHandleId) return null;

  const nodes = anyState.getNodes();
  const n = nodes.find((x) => x.id === sourceNodeId);
  const outputs =
    (n?.data as { outputs?: { name: string; value_type: string }[] } | undefined)?.outputs ?? [];
  const baseHandle = normalizeAppendableHandle(String(sourceHandleId));
  const hit = outputs.find((o) => o.name === baseHandle);
  return hit?.value_type ?? null;
}



export const SocketRow = memo(function SocketRow({
  nodeId,
  side,
  socket,
  readOnly,
}: {
  nodeId: string;
  side: "input" | "output";
  socket: WorkflowSocketDefinition;
  readOnly: boolean;
}) {
  const isInput = side === "input";
  const updateNodeInternals = useUpdateNodeInternals();
  const isConnecting = useStore((s) => {
    const anyState = s as unknown as {
      connectionNodeId?: string | null;
      connection?: { inProgress?: boolean } | null;
    };
    return Boolean(anyState.connectionNodeId) || Boolean(anyState.connection?.inProgress);
  });
  const sourceValueType = useStore(pickSourceValueTypeFromStore);

  const isAppendable = isInput && socket.render_type === "appendable";
  // 避免订阅整份 edges：只订阅“连接数”这个派生值，减少无关更新导致的重渲染。
  const connectedCountSelector = useCallback(
    (s: unknown) => {
      if (!isAppendable) return 0;
      const anyState = s as { edges?: Array<{ target?: string; targetHandle?: string | null }> };
      const edges = anyState.edges ?? [];
      let n = 0;
      for (const e of edges) {
        if (e.target !== nodeId) continue;
        if (appendableHandleBase(e.targetHandle ?? "") === socket.name) n += 1;
      }
      return n;
    },
    [isAppendable, nodeId, socket.name],
  );
  const connectedCount = useStore(connectedCountSelector);

  const slots = Math.max(1, connectedCount + 1);

  useEffect(() => {
    if (!isAppendable) return;
    updateNodeInternals(nodeId);
  }, [connectedCount, isAppendable, nodeId, updateNodeInternals]);


  return (
    <div className="flex flex-col gap-2">
      {(isAppendable ? Array.from({ length: slots }, (_, i) => i + 1) : [0]).map(
        (slotIndex) => {
          const handleId =
            slotIndex === 0 ? socket.name : appendableHandleId(socket.name, slotIndex);
          const displayName =
            slotIndex === 0 ? socket.label || socket.name : `${socket.label || socket.name}_${slotIndex}`;
          return (
            <div
              key={handleId}
              className={cn(
                "relative flex items-center gap-2 text-xs text-muted-foreground",
                isInput ? "justify-start pr-2 pl-3" : "justify-end pr-3 pl-2",
              )}
            >
              {/** 拖线时，对类型不匹配的 target handle 显示 disabled 颜色并禁用连接 */}
              {(() => {
                const targetType = (socket.value_type ?? "").trim();
                const sourceType = (sourceValueType ?? "").trim();
                const mismatch =
                  isInput && isConnecting && targetType && sourceType
                    ? targetType !== sourceType
                    : false;
                return (
                  <WorkflowHandle
                    isInput={isInput}
                    id={handleId}
                    disabled={readOnly || mismatch}
                    mismatch={mismatch}
                  />
                );
              })()}
              <span className={cn("flex min-w-0 items-center gap-1", isInput ? "" : "flex-row-reverse")}>
                <span className={cn("truncate", isInput ? "" : "text-right")}>{displayName}</span>
                {socket.description ? <SocketDescriptionTooltip description={socket.description} /> : null}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
});