import { useEffect, useMemo } from "react";
import {
  Handle,
  Position,
  useEdges,
  useUpdateNodeInternals,
} from "reactflow";

import { cn } from "@/lib/utils";

import type { WorkflowSocketDefinition } from "../../types";
import {
  appendableHandleBase,
  appendableHandleId,
} from "../appendable-handle";



export function SocketRow({
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
  const edges = useEdges();
  const updateNodeInternals = useUpdateNodeInternals();

  const isAppendable = isInput && socket.render_type === "appendable";

  const connectedCount = useMemo(() => {
    if (!isAppendable) return 0;
    let n = 0;
    for (const e of edges) {
      if (e.target !== nodeId) continue;
      if (appendableHandleBase(e.targetHandle ?? "") === socket.name) n += 1;
    }
    return n;
  }, [edges, isAppendable, nodeId, socket.name]);

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
            slotIndex === 0 ? socket.name : `${socket.name}_${slotIndex}`;
          return (
            <div
              key={handleId}
              className={cn(
                "relative flex items-center gap-2 text-xs text-muted-foreground",
                isInput ? "justify-start pr-2 pl-3" : "justify-end pr-3 pl-2",
              )}
            >
              <Handle
                type={isInput ? "target" : "source"}
                position={isInput ? Position.Left : Position.Right}
                id={handleId}
                style={{ top: "50%" }}
                isConnectable={!readOnly}
              />
              <span className={cn("truncate", isInput ? "" : "text-right")}>
                {displayName}
              </span>
            </div>
          );
        },
      )}
    </div>
  );
}